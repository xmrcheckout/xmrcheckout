from __future__ import annotations

from dataclasses import dataclass
import hashlib
import logging
import time
from urllib.parse import urlparse

from fastapi import HTTPException, status
from monero.backends.jsonrpc import JSONRPCWallet
from monero.backends.jsonrpc.exceptions import RPCError
import requests
from requests import RequestException
from requests.auth import HTTPDigestAuth

from .config import (
    MONERO_DAEMON_URL,
    MONERO_WALLET_RPC_PASSWORD,
    MONERO_WALLET_RPC_URLS,
    MONERO_WALLET_RPC_USER,
    MONERO_WALLET_RPC_WALLET_PASSWORD,
    MONERO_WALLET_RPC_WALLET_DIR,
)
from .models import User
from .security import decrypt_secret

logger = logging.getLogger(__name__)


def _normalize_daemon_address(value: str | None) -> str | None:
    if not value:
        return None
    parsed = urlparse(value)
    if parsed.scheme:
        address = parsed.netloc
    else:
        address = value.split("/", 1)[0]
    return address.rstrip("/") if address else None


def _normalize_daemon_url(value: str | None) -> str | None:
    if not value:
        return None
    parsed = urlparse(value)
    if parsed.scheme:
        return value.rstrip("/")
    return f"http://{value.rstrip('/')}"


@dataclass(frozen=True)
class SubaddressResult:
    address: str
    address_index: int | None


@dataclass(frozen=True)
class TransferDetail:
    txid: str
    amount_atomic: int
    confirmations: int
    timestamp: int | None
    address: str | None


@dataclass
class WalletBackend:
    client: JSONRPCWallet
    url: str
    current_wallet: str | None = None


class MoneroWalletService:
    def __init__(self) -> None:
        urls = MONERO_WALLET_RPC_URLS
        if not urls:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Monero wallet RPC is not configured",
            )
        self._backends: list[WalletBackend] = []
        for url in urls:
            parsed = urlparse(url)
            host = parsed.hostname or "127.0.0.1"
            port = parsed.port or 18082
            client = JSONRPCWallet(
                host=host,
                port=port,
                user=MONERO_WALLET_RPC_USER or None,
                password=MONERO_WALLET_RPC_PASSWORD or None,
            )
            if MONERO_WALLET_RPC_USER and MONERO_WALLET_RPC_PASSWORD:
                # monero-wallet-rpc uses digest auth when rpc-login is set.
                client.session.auth = HTTPDigestAuth(
                    MONERO_WALLET_RPC_USER, MONERO_WALLET_RPC_PASSWORD
                )
            self._backends.append(WalletBackend(client=client, url=url))
        self._daemon_url = _normalize_daemon_url(MONERO_DAEMON_URL)
        self._daemon_address = _normalize_daemon_address(MONERO_DAEMON_URL)
        self._wallet_dir = MONERO_WALLET_RPC_WALLET_DIR.strip()

    def get_status(self) -> dict[str, str]:
        for backend in self._backends:
            try:
                backend.client.raw_request("get_version")
            except Exception:
                return {"wallet_rpc": "unreachable"}

        if self._daemon_address:
            try:
                self._backends[0].client.raw_request(
                    "set_daemon",
                    {"address": self._daemon_address},
                )
            except RPCError as exc:
                message = str(exc)
                if "no connection to daemon" in message or "no_connection_to_daemon" in message:
                    return {"wallet_rpc": "ok", "daemon": "unreachable"}
        return {"wallet_rpc": "ok", "daemon": "ok" if self._daemon_address else "unknown"}

    def create_subaddress(self, user: User, label: str) -> SubaddressResult:
        start_total = time.monotonic()
        view_key = decrypt_secret(user.view_key_encrypted)
        wallet_name = self._wallet_name(user, user.payment_address, view_key)
        backend = self._backend_for_wallet_name(wallet_name)
        start_wallet = time.monotonic()
        self._ensure_wallet_open(
            backend=backend,
            wallet_name=wallet_name,
            payment_address=user.payment_address,
            view_key=view_key,
        )
        wallet_elapsed = time.monotonic() - start_wallet
        start_daemon = time.monotonic()
        self._ensure_daemon(backend)
        daemon_elapsed = time.monotonic() - start_daemon

        start_create = time.monotonic()
        try:
            response = backend.client.raw_request(
                "create_address",
                {"account_index": 0, "label": label},
            )
        except (RPCError, RequestException) as exc:
            self._raise_wallet_rpc_error(exc)
        create_elapsed = time.monotonic() - start_create
        address = response.get("address")
        if not address:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Monero wallet RPC did not return a subaddress",
            )
        start_store = time.monotonic()
        try:
            backend.client.raw_request("store")
        except RPCError:
            # Storing can fail if the wallet RPC is in an odd state; the
            # subaddress is still valid, but we prefer to surface issues later.
            pass
        store_elapsed = time.monotonic() - start_store
        total_elapsed = time.monotonic() - start_total
        logger.info(
            "create_subaddress timing wallet=%.3fs daemon=%.3fs create=%.3fs store=%.3fs total=%.3fs",
            wallet_elapsed,
            daemon_elapsed,
            create_elapsed,
            store_elapsed,
            total_elapsed,
        )
        return SubaddressResult(
            address=address,
            address_index=response.get("address_index"),
        )

    def get_received_atomic(
        self,
        user: User,
        address: str,
    ) -> tuple[int, int]:
        view_key = decrypt_secret(user.view_key_encrypted)
        wallet_name = self._wallet_name(user, user.payment_address, view_key)
        backend = self._backend_for_wallet_name(wallet_name)
        self._ensure_wallet_open(
            backend=backend,
            wallet_name=wallet_name,
            payment_address=user.payment_address,
            view_key=view_key,
        )
        self._ensure_daemon(backend)
        try:
            index_response = backend.client.raw_request(
                "get_address_index",
                {"address": address},
            )
        except (RPCError, RequestException) as exc:
            self._raise_wallet_rpc_error(exc)
        index = index_response.get("index") if isinstance(index_response, dict) else None
        major = index.get("major") if isinstance(index, dict) else None
        minor = index.get("minor") if isinstance(index, dict) else None
        if major is None or minor is None:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Monero wallet RPC did not return an address index",
            )
        try:
            transfers = backend.client.raw_request(
                "get_transfers",
                {
                    "in": True,
                    "pool": True,
                    "account_index": major,
                    "subaddr_indices": [minor],
                },
            )
        except (RPCError, RequestException) as exc:
            self._raise_wallet_rpc_error(exc)
        incoming = transfers.get("in", []) if isinstance(transfers, dict) else []
        pool = transfers.get("pool", []) if isinstance(transfers, dict) else []
        total_atomic = 0
        max_confirmations = 0
        seen_txids: set[str] = set()
        for item in [*incoming, *pool]:
            if not isinstance(item, dict):
                continue
            txid = item.get("txid")
            if isinstance(txid, str):
                if txid in seen_txids:
                    continue
                seen_txids.add(txid)
            total_atomic += int(item.get("amount", 0) or 0)
            confirmations = int(item.get("confirmations", 0) or 0)
            if confirmations > max_confirmations:
                max_confirmations = confirmations
        return total_atomic, max_confirmations

    def get_transfers_for_address(
        self,
        user: User,
        address: str,
    ) -> list[TransferDetail]:
        view_key = decrypt_secret(user.view_key_encrypted)
        wallet_name = self._wallet_name(user, user.payment_address, view_key)
        backend = self._backend_for_wallet_name(wallet_name)
        self._ensure_wallet_open(
            backend=backend,
            wallet_name=wallet_name,
            payment_address=user.payment_address,
            view_key=view_key,
        )
        self._ensure_daemon(backend)
        try:
            index_response = backend.client.raw_request(
                "get_address_index",
                {"address": address},
            )
        except (RPCError, RequestException) as exc:
            self._raise_wallet_rpc_error(exc)
        index = index_response.get("index") if isinstance(index_response, dict) else None
        major = index.get("major") if isinstance(index, dict) else None
        minor = index.get("minor") if isinstance(index, dict) else None
        if major is None or minor is None:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Monero wallet RPC did not return an address index",
            )
        try:
            transfers = backend.client.raw_request(
                "get_transfers",
                {
                    "in": True,
                    "pool": True,
                    "account_index": major,
                    "subaddr_indices": [minor],
                },
            )
        except (RPCError, RequestException) as exc:
            self._raise_wallet_rpc_error(exc)
        incoming = transfers.get("in", []) if isinstance(transfers, dict) else []
        pool = transfers.get("pool", []) if isinstance(transfers, dict) else []
        details: list[TransferDetail] = []
        seen_txids: set[str] = set()
        for item in [*incoming, *pool]:
            if not isinstance(item, dict):
                continue
            txid = item.get("txid")
            if not isinstance(txid, str) or not txid:
                continue
            if txid in seen_txids:
                continue
            seen_txids.add(txid)
            amount_atomic = int(item.get("amount", 0) or 0)
            confirmations = int(item.get("confirmations", 0) or 0)
            timestamp = item.get("timestamp")
            timestamp_value = int(timestamp) if isinstance(timestamp, (int, float)) else None
            details.append(
                TransferDetail(
                    txid=txid,
                    amount_atomic=amount_atomic,
                    confirmations=confirmations,
                    timestamp=timestamp_value,
                    address=item.get("address") if isinstance(item.get("address"), str) else None,
                )
            )
        return details

    @staticmethod
    def _rpc_error_message(exc: RPCError) -> str:
        message = str(exc)
        error = getattr(exc, "error", None)
        if isinstance(error, dict):
            detail = error.get("message")
            if detail:
                message = f"{message} {detail}"
        return message

    def _daemon_height(self) -> int | None:
        if not self._daemon_url:
            return None
        url = self._daemon_url.rstrip("/")
        payload = {"jsonrpc": "2.0", "id": "0", "method": "get_height"}
        try:
            response = requests.post(f"{url}/json_rpc", json=payload, timeout=5)
            response.raise_for_status()
            data = response.json()
            result = data.get("result") if isinstance(data, dict) else None
            height = result.get("height") if isinstance(result, dict) else None
            if isinstance(height, int):
                return height
        except (requests.RequestException, ValueError):
            pass

        try:
            response = requests.get(f"{url}/get_height", timeout=5)
            response.raise_for_status()
            data = response.json()
        except (requests.RequestException, ValueError):
            return None
        height = data.get("height") if isinstance(data, dict) else None
        return height if isinstance(height, int) else None

    @staticmethod
    def _wallet_name(user: User, payment_address: str, view_key: str) -> str:
        fingerprint = hashlib.sha256(
            f"{payment_address}:{view_key}".encode("utf-8")
        ).hexdigest()[:12]
        return f"user-{user.id}-{fingerprint}"

    def _backend_for_wallet_name(self, wallet_name: str) -> WalletBackend:
        digest = hashlib.sha256(wallet_name.encode("utf-8")).hexdigest()
        index = int(digest, 16) % len(self._backends)
        return self._backends[index]

    def _ensure_wallet_open(
        self,
        *,
        backend: WalletBackend,
        wallet_name: str,
        payment_address: str,
        view_key: str,
    ) -> None:
        if backend.current_wallet == wallet_name:
            return
        close_start = time.monotonic()
        try:
            backend.client.raw_request("close_wallet")
        except (RPCError, RequestException):
            pass
        close_elapsed = time.monotonic() - close_start
        open_start = time.monotonic()
        try:
            backend.client.raw_request(
                "open_wallet",
                {"filename": wallet_name, "password": MONERO_WALLET_RPC_WALLET_PASSWORD},
            )
            backend.current_wallet = wallet_name
            open_elapsed = time.monotonic() - open_start
            logger.info(
                "wallet open timing close=%.3fs open=%.3fs",
                close_elapsed,
                open_elapsed,
            )
        except (RPCError, RequestException):
            try:
                restore_height = self._daemon_height() or 0
                gen_start = time.monotonic()
                # generate_from_keys opens the wallet when successful.
                backend.client.raw_request(
                    "generate_from_keys",
                    {
                        "restore_height": restore_height,
                        "filename": wallet_name,
                        "address": payment_address,
                        "viewkey": view_key,
                        "password": MONERO_WALLET_RPC_WALLET_PASSWORD,
                    },
                )
                backend.current_wallet = wallet_name
                gen_elapsed = time.monotonic() - gen_start
                open_elapsed = time.monotonic() - open_start
                logger.info(
                    "wallet generate timing close=%.3fs open_fail=%.3fs generate=%.3fs",
                    close_elapsed,
                    open_elapsed,
                    gen_elapsed,
                )
            except (RPCError, RequestException) as gen_exc:
                if isinstance(gen_exc, RequestException):
                    raise HTTPException(
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        detail="Monero wallet RPC is unreachable",
                    ) from gen_exc
                gen_message = self._rpc_error_message(gen_exc).lower()
                if "wallet_files_doesnt_correspond" in gen_message or "file_exists" in gen_message:
                    expected_path = (
                        f"{self._wallet_dir.rstrip('/')}/{wallet_name}"
                        if self._wallet_dir
                        else wallet_name
                    )
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=(
                            "Wallet file exists but could not be opened. Verify the wallet "
                            "password, wallet directory, and that the cache file matches the "
                            ".keys file. If needed, remove or rename the wallet cache file "
                            f"to rebuild it. Expected filename: {expected_path}"
                        ),
                    ) from gen_exc
                raise

    def _ensure_daemon(self, backend: WalletBackend) -> None:
        if not self._daemon_address:
            return
        try:
            backend.client.raw_request(
                "set_daemon",
                {"address": self._daemon_address},
            )
        except (RPCError, RequestException) as exc:
            self._raise_wallet_rpc_error(exc)

    @staticmethod
    def _raise_wallet_rpc_error(exc: Exception) -> None:
        if isinstance(exc, RequestException):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Monero wallet RPC is unreachable",
            ) from exc
        message = str(exc)
        if "no connection to daemon" in message or "no_connection_to_daemon" in message:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Wallet RPC cannot reach the Monero daemon",
            ) from exc
        raise
