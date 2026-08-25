from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urljoin, urlsplit

import requests


WEBHOOK_URL_ERROR = "Webhook URL must use HTTPS and resolve only to public addresses"
_REDIRECT_STATUSES = {301, 302, 303, 307, 308}


class UnsafeWebhookUrl(ValueError):
    pass


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
    current_url = url
    for _ in range(max_redirects + 1):
        validate_webhook_url(current_url)
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
