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
    print(command("docker", "exec", api, "python", "-m", "unittest", "tests.test_payment_links"), flush=True)
    # Server-rendered invoice page must not contain the confirmation message before confirmation.
    message = "Thanks <b>buyer</b>!\nDownload: https://merchant.example/ebook-1.pdf."
    request = urllib.request.Request(base + "/api/core/payment-links", method="POST", headers={"Authorization": "ApiKey fixture-only-api-key", "Content-Type": "application/json"},
        data=json.dumps({"title": "Ebook 1", "amount_xmr": "0.1", "confirmation_target": 1, "confirmation_message": message}).encode())
    token = json.load(urllib.request.urlopen(request, timeout=10))["url"].rsplit("/", 1)[1]
    request = urllib.request.Request(base + f"/api/core/public/payment-links/{token}/invoices", method="POST", headers={"Accept": "application/json"})
    invoice_id = json.load(urllib.request.urlopen(request, timeout=10))["invoice_url"].rsplit("/", 1)[1]
    pending = urllib.request.urlopen(base + f"/invoice/{invoice_id}", timeout=30).read().decode()
    assert "Invoice timeline" in pending and "ebook-1" not in pending and "buyer" not in pending, "message leaked before confirmation"
    command("docker", "exec", dbname, "psql", "-U", "fixture", "-d", "payment_link_tests", "-c", f"UPDATE invoices SET status='confirmed', confirmations=1, confirmed_at=now() WHERE id='{invoice_id}'")
    confirmed = urllib.request.urlopen(base + f"/invoice/{invoice_id}", timeout=30).read().decode()
    assert "Message from the merchant" in confirmed, "message missing after confirmation"
    assert 'href="https://merchant.example/ebook-1.pdf"' in confirmed and 'rel="noopener noreferrer nofollow"' in confirmed
    assert "Thanks &lt;b&gt;buyer&lt;/b&gt;!" in confirmed and "<b>buyer</b>" not in confirmed
    print("Confirmation message server-render checks passed.", flush=True)
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
