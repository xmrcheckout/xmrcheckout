"""Small wallet transport that never logs credentials, parameters, or responses."""
import requests
from fastapi import HTTPException
from monero.backends.jsonrpc.exceptions import RPCError, Unauthorized
from requests.auth import HTTPDigestAuth


class WalletRPC:
    def __init__(self, *, host, port, user=None, password=None):
        self.url = f"http://{host}:{port}/json_rpc"
        self.session = requests.Session()
        self.session.auth = HTTPDigestAuth(user or "", password or "")

    def raw_request(self, method, params=None):
        response = self.session.post(
            self.url, json={"jsonrpc": "2.0", "id": 0, "method": method, "params": params or {}},
            timeout=30,
        )
        if response.status_code == 401:
            raise Unauthorized("Wallet RPC authentication failed")
        if response.status_code != 200:
            raise RPCError("Wallet RPC HTTP request failed")
        try:
            result = response.json()
        except ValueError:
            raise HTTPException(502, "Monero wallet RPC returned a malformed transfer response") from None
        if not isinstance(result, dict):
            raise HTTPException(502, "Monero wallet RPC returned a malformed transfer response")
        if "error" in result:
            error = result["error"]
            code = error.get("code") if isinstance(error, dict) else None
            # Existing wallet-open recovery inspects the message internally. Never log it.
            message = error.get("message") if isinstance(error, dict) else None
            exc = RPCError(message if isinstance(message, str) else "Wallet RPC request failed")
            exc.error = {"code": code if type(code) is int else None}
            raise exc
        if "result" not in result:
            raise HTTPException(502, "Monero wallet RPC returned a malformed transfer response")
        return result["result"]
