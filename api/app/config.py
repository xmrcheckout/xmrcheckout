import os


def _get_bool_env(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None or value == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _get_env(name: str, default: str | None = None) -> str:
    value = os.getenv(name, default)
    if value is None or value == "":
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


DATABASE_URL = _get_env("DATABASE_URL")

API_KEYS = [
    key.strip()
    for key in os.getenv("API_KEYS", "").split(",")
    if key.strip()
]

API_KEY_ENCRYPTION_KEY = _get_env("API_KEY_ENCRYPTION_KEY")
INVOICE_RECONCILE_INTERVAL_SECONDS = int(os.getenv("INVOICE_RECONCILE_INTERVAL_SECONDS", "30"))
INVOICE_DEFAULT_EXPIRY_HOURS = int(os.getenv("INVOICE_DEFAULT_EXPIRY_HOURS", "24"))
LATE_PAYMENT_LOOKBACK_HOURS = int(os.getenv("LATE_PAYMENT_LOOKBACK_HOURS", "48"))
DONATION_EXPIRY_MINUTES = int(os.getenv("DONATION_EXPIRY_MINUTES", "30"))
DONATION_ACTIVE_INVOICE_LIMIT = int(os.getenv("DONATION_ACTIVE_INVOICE_LIMIT", "25"))
COINGECKO_API_KEY = os.getenv("COINGECKO_API_KEY", "")
DONATIONS_ENABLED = _get_bool_env("DONATIONS_ENABLED", False)

MONERO_WALLET_RPC_URLS = [
    url.strip()
    for url in os.getenv("MONERO_WALLET_RPC_URLS", "").split(",")
    if url.strip()
]
MONERO_WALLET_RPC_USER = os.getenv("MONERO_WALLET_RPC_USER", "")
MONERO_WALLET_RPC_PASSWORD = os.getenv("MONERO_WALLET_RPC_PASSWORD", "")
MONERO_WALLET_RPC_WALLET_PASSWORD = os.getenv("MONERO_WALLET_RPC_WALLET_PASSWORD", "")
MONERO_DAEMON_URL = os.getenv("MONERO_DAEMON_URL")
MONERO_WALLET_RPC_WALLET_DIR = os.getenv("MONERO_WALLET_RPC_WALLET_DIR", "")
FOUNDER_PAYMENT_ADDRESS = os.getenv("FOUNDER_PAYMENT_ADDRESS", "")
FOUNDER_VIEW_KEY = os.getenv("FOUNDER_VIEW_KEY", "")
QR_STORAGE_DIR = os.getenv("QR_STORAGE_DIR", "/qr")
