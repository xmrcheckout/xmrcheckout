from __future__ import annotations

import base64
import os
import tempfile
from dataclasses import dataclass
from typing import Any

from fastapi import HTTPException, status
import qrcode
from qrcode.constants import ERROR_CORRECT_H
from PIL import Image

from .formatting import format_xmr_amount
from .models import Invoice


@dataclass(frozen=True)
class QrSettings:
    logo: str  # "monero" | "none" | "custom"
    logo_data_url: str | None = None


def invoice_qr_url(invoice_id: str) -> str:
    return f"/qr/{invoice_id}.png"


def ensure_invoice_qr_png(
    *,
    invoice: Invoice,
    storage_dir: str,
    settings: QrSettings,
) -> str:
    if not storage_dir:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="QR storage is not configured",
        )
    os.makedirs(storage_dir, exist_ok=True)
    try:
        os.chmod(storage_dir, 0o755)
    except Exception:
        pass
    filename = f"{invoice.id}.png"
    path = os.path.join(storage_dir, filename)
    if os.path.exists(path):
        try:
            os.chmod(path, 0o644)
        except Exception:
            pass
        return path
    png_bytes = build_invoice_qr_png_bytes(invoice=invoice, settings=settings)
    _atomic_write(path, png_bytes)
    try:
        os.chmod(path, 0o644)
    except Exception:
        pass
    return path


def build_invoice_qr_png_bytes(*, invoice: Invoice, settings: QrSettings) -> bytes:
    uri = build_monero_uri(invoice)
    qr = qrcode.QRCode(
        error_correction=ERROR_CORRECT_H,
        border=2,
        box_size=10,
    )
    qr.add_data(uri)
    qr.make(fit=True)
    image = qr.make_image(fill_color="black", back_color="white").convert("RGBA")

    if settings.logo == "custom" and settings.logo_data_url:
        logo = _load_logo_from_data_url(settings.logo_data_url)
        image = _overlay_logo(image, logo)

    out = tempfile.SpooledTemporaryFile(max_size=1024 * 1024)
    image.save(out, format="PNG", optimize=True)
    out.seek(0)
    return out.read()


def build_monero_uri(invoice: Invoice) -> str:
    amount = format_xmr_amount(invoice.amount_xmr)
    params: dict[str, str] = {"tx_amount": amount}
    metadata = invoice.metadata_json or {}
    if isinstance(metadata, dict):
        recipient_name = metadata.get("recipient_name")
        description = metadata.get("description")
        if isinstance(recipient_name, str) and recipient_name.strip():
            params["recipient_name"] = recipient_name.strip()
        if isinstance(description, str) and description.strip():
            params["tx_description"] = description.strip()
    query = "&".join(f"{_url_escape(k)}={_url_escape(v)}" for k, v in params.items())
    return f"monero:{invoice.address}?{query}"


def resolve_qr_settings(invoice: Invoice) -> QrSettings:
    metadata: Any = invoice.metadata_json or {}
    if not isinstance(metadata, dict):
        return QrSettings(logo="monero", logo_data_url=None)
    qr_meta = metadata.get("qr")
    if not isinstance(qr_meta, dict):
        return QrSettings(logo="monero", logo_data_url=None)
    logo = qr_meta.get("logo")
    logo_data_url = qr_meta.get("logo_data_url")
    if not isinstance(logo, str) or logo not in ("monero", "none", "custom"):
        return QrSettings(logo="monero", logo_data_url=None)
    if logo == "custom" and isinstance(logo_data_url, str) and logo_data_url.strip():
        return QrSettings(logo="custom", logo_data_url=logo_data_url.strip())
    return QrSettings(logo=logo, logo_data_url=None)


def _atomic_write(path: str, data: bytes) -> None:
    directory = os.path.dirname(path) or "."
    os.makedirs(directory, exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(prefix=".tmp-", dir=directory)
    try:
        with os.fdopen(fd, "wb") as tmp_file:
            tmp_file.write(data)
            tmp_file.flush()
            os.fsync(tmp_file.fileno())
        os.replace(tmp_path, path)
    finally:
        try:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
        except Exception:
            pass


def _load_logo_from_data_url(data_url: str) -> Image.Image:
    # Expected: data:image/png;base64,<...>
    try:
        header, encoded = data_url.split(",", 1)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="QR logo must be a data URL",
        ) from exc
    if ";base64" not in header:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="QR logo must be base64 encoded",
        )
    try:
        raw = base64.b64decode(encoded, validate=True)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="QR logo could not be decoded",
        ) from exc
    try:
        from io import BytesIO

        logo = Image.open(BytesIO(raw)).convert("RGBA")
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="QR logo image format is not supported",
        ) from exc
    return logo


def _overlay_logo(qr_image: Image.Image, logo: Image.Image) -> Image.Image:
    # Center a small logo with a white backing.
    size = min(qr_image.size)
    target_logo_size = int(size * 0.22)
    if target_logo_size < 24:
        return qr_image
    logo = logo.copy()
    logo.thumbnail((target_logo_size, target_logo_size), Image.LANCZOS)

    overlay = Image.new("RGBA", qr_image.size, (255, 255, 255, 0))
    box_size = int(size * 0.28)
    box_offset = int((size - box_size) / 2)
    box = Image.new("RGBA", (box_size, box_size), (255, 255, 255, 255))
    overlay.paste(box, (box_offset, box_offset))

    logo_offset = (int((size - logo.size[0]) / 2), int((size - logo.size[1]) / 2))
    overlay.paste(logo, logo_offset, mask=logo)

    return Image.alpha_composite(qr_image, overlay)


def _url_escape(value: str) -> str:
    from urllib.parse import quote

    return quote(value, safe="")
