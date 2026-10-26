"""Exercise built images on an isolated network, with fixture credentials only."""

import argparse
import concurrent.futures
import json
import os
from pathlib import Path
import select
import socket
import socketserver
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
CANARY = "request-protection-secret-canary"


def command(*args, input=None):
    result = subprocess.run(args, input=input, text=True, capture_output=True, timeout=90)
    if result.returncode:
        raise RuntimeError(f"{' '.join(args[:4])}: {result.stderr or result.stdout}")
    return result.stdout.strip()


def local_forwarder(proxy_ip):
    # Internal Docker networks do not publish ports. Forward only loopback
    # connections into the isolated network; fixture containers have no egress.
    class Forward(socketserver.BaseRequestHandler):
        def handle(self):
            with socket.create_connection((proxy_ip, 80), timeout=10) as upstream:
                peers = [self.request, upstream]
                while True:
                    ready, _, _ = select.select(peers, [], [], 15)
                    if not ready:
                        return
                    for source in ready:
                        try:
                            data = source.recv(65536)
                            if not data:
                                return
                            (upstream if source is self.request else self.request).sendall(data)
                        except (ConnectionResetError, BrokenPipeError):
                            # Browsers cancel prefetches and close pooled sockets.
                            return

    class Server(socketserver.ThreadingTCPServer):
        daemon_threads = True

    server = Server(("127.0.0.1", 0), Forward)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def request(base, path, method="GET", headers=None, body=None):
    req = urllib.request.Request(base + path, data=body, method=method, headers=headers or {})
    try:
        response = urllib.request.urlopen(req, timeout=10)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        return response.status, response.read()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--playwright-module", help="Also run browser flows using this installed Playwright module")
    args = parser.parse_args()
    suffix = f"{os.getpid()}-{int(time.time())}"
    network = f"xmrcheckout-request-tests-{suffix}"
    names = {role: f"{network}-{role}" for role in ("ui", "client", "nginx")}
    artifacts = Path(tempfile.mkdtemp(prefix="xmrcheckout-request-test-"))
    common = ["--network", network, "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--memory", "512m", "--pids-limit", "128"]
    created = []
    forwarder = None
    try:
        command("docker", "network", "create", "--internal", network)
        command("docker", "run", "-d", "--name", names["client"], *common, "--network-alias", "cloudflared", "--user", "1000:1000", "--entrypoint", "sleep", "xmrcheckout-ui", "infinity")
        created.append(names["client"])
        command("docker", "run", "-d", "--name", names["ui"], *common,
                "--network-alias", "ui", "--network-alias", "api", "--user", "1000:1000",
                "--tmpfs", "/tmp:rw,noexec,nosuid,nodev,uid=1000,gid=1000,mode=1777",
                "--tmpfs", "/app/.next/cache:rw,noexec,nosuid,nodev,uid=1000,gid=1000,mode=0750",
                "-e", "API_BASE_URL=http://127.0.0.1:8000",
                "-v", f"{ROOT}/ui/tests/fixture-server.cjs:/fixture.cjs:ro",
                "--entrypoint", "node", "xmrcheckout-ui", "/fixture.cjs")
        created.append(names["ui"])
        command("docker", "run", "-d", "--name", names["nginx"], *common,
                "--user", "101:101", "--sysctl", "net.ipv4.ip_unprivileged_port_start=0",
                "--tmpfs", "/tmp:rw,noexec,nosuid,nodev,uid=101,gid=101,mode=1777",
                "--tmpfs", "/var/cache/nginx:rw,noexec,nosuid,nodev,uid=101,gid=101,mode=0750",
                "--tmpfs", "/var/run:rw,noexec,nosuid,nodev,uid=101,gid=101,mode=0750",
                "-v", f"{ROOT}/nginx/conf.d:/etc/nginx/conf.d:ro", "xmrcheckout-nginx")
        created.append(names["nginx"])
        proxy_ip = command("docker", "inspect", "--format", "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}", names["nginx"])
        forwarder = local_forwarder(proxy_ip)
        port = forwarder.server_address[1]
        base = f"http://127.0.0.1:{port}"
        for attempt in range(50):
            try:
                if request(base, "/")[0] == 200:
                    break
            except (OSError, urllib.error.URLError):
                pass
            time.sleep(0.2)
        else:
            raise AssertionError("Fixture UI did not start")
        command("docker", "exec", names["nginx"], "nginx", "-t")
        assert request(base, "/logo.png", headers={"Content-Type": "multipart/form-data"})[0] == 200

        for content_type in ["multipart/form-data", "multipart/form-data; boundary=", 'multipart/form-data; boundary=""']:
            status, body = request(base, "/app", "POST", {"Content-Type": content_type}, CANARY.encode())
            assert status == 400 and body == b"Invalid multipart boundary.", (status, body)
        assert request(base, "/app", "POST", {"Content-Type": "application/json"}, b"{}")[0] == 404
        for boundary in ["audit-boundary", '"audit boundary"']:
            value = boundary.strip('"')
            status, body = request(base, "/app", "POST", {"Content-Type": f"multipart/form-data; boundary={boundary}"}, f"--{value}--\r\n".encode())
            assert status == 400 and body == b"Invalid Server Action request.", (status, body)
        status, body = request(base, "/app", "POST", {"Content-Type": "multipart/form-data; boundary=audit-boundary"}, b"invalid form")
        assert status == 500 and body == b"Internal Server Error", (status, body)
        print("Header validation, valid quoted forms, and visible application errors: passed", flush=True)

        # Browser flows get a fresh rate bucket before the flood tests.
        if args.playwright_module:
            env = {**os.environ, "PLAYWRIGHT_MODULE": str(Path(args.playwright_module).resolve())}
            subprocess.run(["node", str(ROOT / "ui/tests/browser-request-protection.cjs"), base], env=env, check=True, timeout=120)

        # A host request is not from the trusted tunnel peer: changing CF headers
        # must not change the limiter identity.
        def spoofed_post(index):
            return request(base, "/app", "POST", {"CF-Connecting-IP": f"192.0.2.{index + 1}", "Content-Type": "application/json"}, b"{}")[0]
        with concurrent.futures.ThreadPoolExecutor(max_workers=30) as pool:
            statuses = list(pool.map(spoofed_post, range(30)))
        assert 429 in statuses and set(statuses) <= {404, 429}, statuses
        print("Untrusted client-IP headers cannot bypass UI POST limit: passed", flush=True)

        client_code = r'''
const http = require('node:http');
function send(path, method, ip) { return new Promise((resolve, reject) => {
 const req=http.request({hostname:process.argv[1],port:80,path,method,headers:{'CF-Connecting-IP':ip,'Content-Type':'application/json'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});
 req.setTimeout(10000,()=>req.destroy(new Error('timeout')));req.on('error',reject);req.end(method==='POST'?'{}':undefined);
}); }
(async()=>{
 const post=await Promise.all(Array.from({length:35},()=>send('/app','POST','198.51.100.10')));
 const other=await send('/app','POST','198.51.100.11');
 const get=await Promise.all(Array.from({length:25},()=>send('/logo.png','GET','198.51.100.10')));
 const api=await Promise.all(Array.from({length:25},()=>send('/api/core/auth/validate','POST','198.51.100.10')));
 const global=await Promise.all(Array.from({length:400},()=>send('/_next/static/missing.js','GET','198.51.100.12')));
 console.log(JSON.stringify({post,other,get,api,global}));
})().catch(error=>{console.error(error);process.exitCode=1;});
'''
        results = json.loads(command("docker", "exec", "-i", names["client"], "node", "-e", client_code, proxy_ip))
        assert 404 in results["post"] and 429 in results["post"]
        assert set(results["post"]) <= {404, 429}
        assert results["other"] == 404
        assert set(results["get"]) == {200}
        assert set(results["api"]) == {204}
        assert 429 in results["global"] and 404 in results["global"]
        (artifacts / "rate-results.json").write_text(json.dumps(results, indent=2))
        print("Trusted per-client limits, unaffected GET/API requests, and retained global limit: passed", flush=True)
        for name in (names["ui"], names["nginx"]):
            logs = subprocess.run(["docker", "logs", name], text=True, capture_output=True, check=True)
            for secret in (CANARY, "fixture-only-api-key", "fixture-only-webhook-secret", "1" * 64):
                assert secret not in logs.stdout + logs.stderr
        print("Rejected fields and fixture credentials absent from logs: passed", flush=True)
    finally:
        if forwarder:
            forwarder.shutdown()
            forwarder.server_close()
        for name in reversed(created):
            logs = subprocess.run(["docker", "logs", "--timestamps", name], capture_output=True)
            (artifacts / f"{name}.log").write_bytes(logs.stdout + logs.stderr)
            subprocess.run(["docker", "rm", "-f", name], capture_output=True)
        subprocess.run(["docker", "network", "rm", network], capture_output=True)
        print(f"Isolated test artifacts: {artifacts}", flush=True)


if __name__ == "__main__":
    main()
