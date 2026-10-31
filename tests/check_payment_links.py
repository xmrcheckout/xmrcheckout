"""Real API/PostgreSQL/UI/Nginx with a separate merchant origin; no external access."""
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import ipaddress
import json
import os
from pathlib import Path
import subprocess
import threading
import time
import urllib.request
from check_ui_request_protection import command, local_forwarder, ROOT

parser = argparse.ArgumentParser()
parser.add_argument("--playwright-module", required=True)
args = parser.parse_args()
suffix = str(os.getpid())
network = "payment-link-browser-" + suffix
names = []
forwarder = merchant = None
try:
    command("docker", "network", "create", "--internal", network)
    info = json.loads(command("docker", "network", "inspect", network))[0]
    proxy_ip = str(ipaddress.ip_network(info["IPAM"]["Config"][0]["Subnet"]).network_address + 10)
    forwarder = local_forwarder(proxy_ip)
    base = f"http://127.0.0.1:{forwarder.server_address[1]}"
    peer = f"payment-link-peer-{suffix}"
    names.append(peer)
    command("docker", "run", "-d", "--name", peer, "--network", network, "--network-alias", "cloudflared", "--entrypoint", "sleep", "xmrcheckout-ui", "infinity")
    dbname = f"payment-link-db-{suffix}"
    names.append(dbname)
    command("docker", "run", "-d", "--name", dbname, "--network", network, "--network-alias", "db", "-e", "POSTGRES_DB=payment_link_tests", "-e", "POSTGRES_USER=fixture", "-e", "POSTGRES_PASSWORD=fixture", "postgres:16-alpine")
    for _ in range(60):
        result = subprocess.run(["docker", "exec", dbname, "pg_isready", "-U", "fixture"], capture_output=True)
        if not result.returncode: break
        time.sleep(.2)
    api = f"payment-link-api-{suffix}"
    names.append(api)
    command("docker", "run", "-d", "--name", api, "--network", network, "--network-alias", "api", "-v", f"{ROOT}/api:/app:ro", "-e", "DATABASE_URL=postgresql://fixture:fixture@db/payment_link_tests", "-e", "API_KEY_ENCRYPTION_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", "-e", f"SITE_URL={base}", "xmrcheckout-api", "python", "-m", "tests.payment_link_browser_fixture")
    ui = f"payment-link-ui-{suffix}"
    names.append(ui)
    command("docker", "run", "-d", "--name", ui, "--network", network, "--network-alias", "ui", "-e", "API_BASE_URL=http://api:8000", "xmrcheckout-ui")
    nginx = f"payment-link-nginx-{suffix}"
    names.append(nginx)
    command("docker", "run", "-d", "--name", nginx, "--network", network, "--ip", proxy_ip, "--tmpfs", "/var/cache/nginx:rw,uid=101,gid=101", "--tmpfs", "/var/run:rw,uid=101,gid=101", "--tmpfs", "/tmp:rw,uid=101,gid=101", "--sysctl", "net.ipv4.ip_unprivileged_port_start=0", "-v", f"{ROOT}/nginx/conf.d:/etc/nginx/conf.d:ro", "xmrcheckout-nginx")
    for _ in range(100):
        try:
            if urllib.request.urlopen(base + "/api/core/public/payment-links/fixture-token", timeout=2).status == 200: break
        except Exception: time.sleep(.2)
    class Merchant(BaseHTTPRequestHandler):
        snippet = b""

        def do_POST(self):
            Merchant.snippet = self.rfile.read(int(self.headers["Content-Length"]))
            self.send_response(204)
            self.end_headers()

        def do_GET(self):
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(Merchant.snippet)
        def log_message(self, *args): pass
    merchant = ThreadingHTTPServer(("127.0.0.1", 0), Merchant)
    threading.Thread(target=merchant.serve_forever, daemon=True).start()
    merchant_base = f"http://127.0.0.1:{merchant.server_address[1]}"
    subprocess.run(["node", str(ROOT / "ui/tests/browser-payment-links.cjs"), base, merchant_base], env={**os.environ, "PLAYWRIGHT_MODULE": str(Path(args.playwright_module).resolve())}, check=True, timeout=180)
    print("Real API/PostgreSQL/Nginx cross-origin checks passed.")
finally:
    if merchant: merchant.shutdown()
    if forwarder: forwarder.shutdown()
    for name in reversed(names): subprocess.run(["docker", "rm", "-f", name], capture_output=True)
    subprocess.run(["docker", "network", "rm", network], capture_output=True)
