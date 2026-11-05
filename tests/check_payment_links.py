"""Real API/PostgreSQL/UI/Nginx with a separate merchant origin; no external access."""
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import ipaddress
import json
import os
from pathlib import Path
import shutil
import subprocess
import threading
import time
import urllib.request
from check_ui_request_protection import INSECURE_TLS, ROOT, command, image, local_forwarder, nginx_conf_dir

parser = argparse.ArgumentParser()
parser.add_argument("--playwright-module", required=True)
args = parser.parse_args()
suffix = str(os.getpid())
network = "payment-link-browser-" + suffix
names = []
forwarder = merchant = None
conf_dir = nginx_conf_dir()
try:
    command("docker", "network", "create", "--internal", network)
    info = json.loads(command("docker", "network", "inspect", network))[0]
    proxy_ip = str(ipaddress.ip_network(info["IPAM"]["Config"][0]["Subnet"]).network_address + 10)
    forwarder = local_forwarder(proxy_ip)
    base = f"https://127.0.0.1:{forwarder.server_address[1]}"
    dbname = f"payment-link-db-{suffix}"
    names.append(dbname)
    command("docker", "run", "-d", "--name", dbname, "--network", network, "--network-alias", "db", "-e", "POSTGRES_DB=payment_link_tests", "-e", "POSTGRES_USER=fixture", "-e", "POSTGRES_PASSWORD=fixture", "postgres:16-alpine")
    for _ in range(60):
        result = subprocess.run(["docker", "exec", dbname, "pg_isready", "-U", "fixture"], capture_output=True)
        if not result.returncode: break
        time.sleep(.2)
    api = f"payment-link-api-{suffix}"
    names.append(api)
    command("docker", "run", "-d", "--name", api, "--network", network, "--network-alias", "api", "-v", f"{ROOT}/api:/app:ro", "-e", "DATABASE_URL=postgresql://fixture:fixture@db/payment_link_tests", "-e", "API_KEY_ENCRYPTION_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", "-e", f"SITE_URL={base}", image("api"), "python", "-m", "tests.payment_link_browser_fixture")
    ui = f"payment-link-ui-{suffix}"
    names.append(ui)
    command("docker", "run", "-d", "--name", ui, "--network", network, "--network-alias", "ui", "-e", "API_BASE_URL=http://api:8000", image("ui"))
    nginx = f"payment-link-nginx-{suffix}"
    names.append(nginx)
    command("docker", "run", "-d", "--name", nginx, "--network", network, "--ip", proxy_ip, "--tmpfs", "/var/cache/nginx:rw,uid=101,gid=101", "--tmpfs", "/var/run:rw,uid=101,gid=101", "--tmpfs", "/tmp:rw,uid=101,gid=101", "--tmpfs", "/etc/nginx/certs:rw,uid=101,gid=101,mode=0700", "--user", "101:101", "--sysctl", "net.ipv4.ip_unprivileged_port_start=0", "-v", f"{conf_dir}:/etc/nginx/conf.d:ro", image("nginx"))
    for _ in range(100):
        try:
            if urllib.request.urlopen(base + "/api/core/public/payment-links/fixture-token", timeout=2, context=INSECURE_TLS).status == 200: break
        except Exception: time.sleep(.2)
    print(command("docker", "exec", api, "python", "-m", "unittest", "tests.test_payment_links"), flush=True)
    # Server-rendered invoice page must not contain the confirmation message before confirmation.
    message = "Thanks <b>buyer</b>!\nDownload: https://merchant.example/ebook-1.pdf."
    request = urllib.request.Request(base + "/api/core/payment-links", method="POST", headers={"Authorization": "ApiKey fixture-only-api-key", "Content-Type": "application/json"},
        data=json.dumps({"title": "Ebook 1", "amount_xmr": "0.1", "confirmation_target": 1, "confirmation_message": message}).encode())
    token = json.load(urllib.request.urlopen(request, timeout=10, context=INSECURE_TLS))["url"].rsplit("/", 1)[1]
    request = urllib.request.Request(base + f"/api/core/public/payment-links/{token}/invoices", method="POST", headers={"Accept": "application/json"})
    invoice_id = json.load(urllib.request.urlopen(request, timeout=10, context=INSECURE_TLS))["invoice_url"].rsplit("/", 1)[1]
    pending = urllib.request.urlopen(base + f"/invoice/{invoice_id}", timeout=30, context=INSECURE_TLS).read().decode()
    # Pages embed UI catalog text that mentions buyers and an example ebook link,
    # so look for the merchant's own message by its unique URL.
    assert "Invoice timeline" in pending and "merchant.example" not in pending, "message leaked before confirmation"
    command("docker", "exec", dbname, "psql", "-U", "fixture", "-d", "payment_link_tests", "-c", f"UPDATE invoices SET status='confirmed', confirmations=1, confirmed_at=now() WHERE id='{invoice_id}'")
    confirmed = urllib.request.urlopen(base + f"/invoice/{invoice_id}", timeout=30, context=INSECURE_TLS).read().decode()
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
    subprocess.run(["node", str(ROOT / "ui/tests/browser-payment-links.cjs"), base, merchant_base], env={**os.environ, "PLAYWRIGHT_MODULE": str(Path(args.playwright_module).resolve()), "NODE_TLS_REJECT_UNAUTHORIZED": "0"}, check=True, timeout=180)
    print("Real API/PostgreSQL/Nginx cross-origin checks passed.")
finally:
    if merchant: merchant.shutdown()
    if forwarder: forwarder.shutdown()
    for name in reversed(names): subprocess.run(["docker", "rm", "-f", name], capture_output=True)
    subprocess.run(["docker", "network", "rm", network], capture_output=True)
    shutil.rmtree(conf_dir, ignore_errors=True)
