from __future__ import annotations

import base64
import ipaddress
import json
import os
import socket
from urllib.parse import urljoin, urlsplit

import requests


WEBHOOK_URL_ERROR = "Webhook URL must use HTTPS and resolve only to public addresses"
_REDIRECT_STATUSES = {301, 302, 303, 307, 308}


class UnsafeWebhookUrl(ValueError):
    pass


def _relay_settings() -> tuple[str, str] | None:
    enabled = os.getenv("WEBHOOK_RELAY_ENABLED", "false").strip().lower()
    if enabled in {"", "false", "0", "no", "off"}:
        return None
    if enabled not in {"true", "1", "yes", "on"}:
        raise requests.RequestException("Invalid webhook relay configuration")
    url = os.getenv("WEBHOOK_RELAY_URL", "")
    token = os.getenv("WEBHOOK_RELAY_TOKEN", "")
    try:
        parsed = urlsplit(url)
        valid = (
            parsed.scheme == "https" and parsed.hostname
            and parsed.username is None and parsed.password is None
            and not parsed.query and not parsed.fragment
            and parsed.port in {None, 443} and len(token) >= 32
            and token.isascii() and token.isprintable()
            and not any(char.isspace() for char in token)
        )
    except ValueError:
        valid = False
    if not valid:
        raise requests.RequestException("Invalid webhook relay configuration")
    return url, token


def _post_via_relay(
    relay: tuple[str, str], url: str, data: bytes,
    headers: dict[str, str], timeout: int,
) -> requests.Response:
    if len(data) > 1024 * 1024:
        raise requests.RequestException("Webhook relay payload exceeds 1 MiB")
    target = urlsplit(url)
    if target.hostname == urlsplit(relay[0]).hostname:
        raise UnsafeWebhookUrl("Webhook relay cannot deliver to itself")
    try:
        ipaddress.ip_address(target.hostname or "")
    except ValueError:
        pass
    else:
        raise UnsafeWebhookUrl("Webhook relay destinations require a DNS hostname")
    allowed = {"content-type", "user-agent", "x-webhook-secret", "btcpay-sig"}
    envelope = {
        "version": 1, "url": url,
        "body_base64": base64.b64encode(data).decode("ascii"),
        "headers": {key: value for key, value in headers.items() if key.lower() in allowed},
        "timeout_ms": timeout * 1000,
    }
    try:
        # Do not inherit ambient proxy settings or follow a relay redirect with credentials.
        with requests.Session() as session:
            session.trust_env = False
            with session.post(
                relay[0], json=envelope,
                headers={"Authorization": f"Bearer {relay[1]}"},
                timeout=timeout + 5, allow_redirects=False, stream=True,
            ) as response:
                if response.status_code != 200:
                    if response.status_code == 422:
                        raise UnsafeWebhookUrl("Webhook relay rejected destination")
                    raise requests.RequestException("Webhook relay request failed")
                raw = bytearray()
                for chunk in response.iter_content(chunk_size=4096):
                    raw.extend(chunk)
                    if len(raw) > 65536:
                        raise ValueError("Relay response too large")
                result = json.loads(raw)
        code = result["http_status"]
        location = result.get("location")
        if (result.get("version") != 1 or type(code) is not int
                or not 200 <= code <= 599
                or (location is not None and not isinstance(location, str))):
            raise ValueError("Invalid relay response")
    except UnsafeWebhookUrl:
        raise
    except (requests.RequestException, ValueError, KeyError, TypeError, RecursionError):
        raise requests.RequestException("Webhook relay delivery failed") from None
    delivered = requests.Response()
    delivered.status_code = code
    delivered.url = url
    if location:
        delivered.headers["Location"] = location
    return delivered


def validate_webhook_url(url: str) -> str:
    try:
        parsed = urlsplit(url)
        port = parsed.port or 443
    except ValueError as exc:
        raise UnsafeWebhookUrl(WEBHOOK_URL_ERROR) from exc
    if (
        parsed.scheme.lower() != "https"
        or not parsed.hostname
        or parsed.username is not None
        or parsed.password is not None
    ):
        raise UnsafeWebhookUrl(WEBHOOK_URL_ERROR)

    try:
        results = socket.getaddrinfo(
            parsed.hostname,
            port,
            type=socket.SOCK_STREAM,
        )
    except OSError as exc:
        raise UnsafeWebhookUrl(WEBHOOK_URL_ERROR) from exc
    if not results:
        raise UnsafeWebhookUrl(WEBHOOK_URL_ERROR)

    for _family, _type, _proto, _canonname, sockaddr in results:
        address_text = str(sockaddr[0]).split("%", 1)[0]
        try:
            address = ipaddress.ip_address(address_text)
        except ValueError as exc:
            raise UnsafeWebhookUrl(WEBHOOK_URL_ERROR) from exc
        if isinstance(address, ipaddress.IPv6Address) and address.ipv4_mapped:
            address = address.ipv4_mapped
        if (
            not address.is_global
            or address.is_loopback
            or address.is_private
            or address.is_link_local
            or address.is_multicast
            or address.is_reserved
            or address.is_unspecified
        ):
            raise UnsafeWebhookUrl(WEBHOOK_URL_ERROR)
    return url


def post_webhook_with_redirects(
    url: str,
    *,
    data: bytes,
    headers: dict[str, str],
    timeout: int,
    max_redirects: int = 3,
) -> requests.Response | None:
    relay = _relay_settings()
    current_url = url
    for _ in range(max_redirects + 1):
        validate_webhook_url(current_url)
        if relay is not None:
            response = _post_via_relay(relay, current_url, data, headers, timeout)
        else:
            response = requests.post(
                current_url,
                data=data,
                headers=headers,
                timeout=timeout,
                allow_redirects=False,
            )
        if response.status_code not in _REDIRECT_STATUSES:
            return response
        location = response.headers.get("Location")
        if not location:
            return response
        current_url = urljoin(current_url, location)
    return None
