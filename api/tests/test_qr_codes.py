import base64
import os
import tempfile
import unittest
import uuid
from decimal import Decimal
from io import BytesIO
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException
from PIL import Image

from app import qr_codes
from app.qr_codes import QrSettings


def _data_url(image, fmt="PNG"):
    out = BytesIO()
    image.save(out, format=fmt)
    return f"data:image/{fmt.lower()};base64," + base64.b64encode(out.getvalue()).decode()


def _invoice():
    return SimpleNamespace(id=uuid.uuid4(), address="8" + "A" * 94, amount_xmr=Decimal("0.5"), metadata_json={})


class QrLogoTests(unittest.TestCase):
    def test_small_logo_is_overlaid(self):
        logo = _data_url(Image.new("RGBA", (64, 64), (255, 0, 0, 255)))
        invoice = _invoice()
        plain = qr_codes.build_invoice_qr_png_bytes(invoice=invoice, settings=QrSettings(logo="none"))
        with_logo = qr_codes.build_invoice_qr_png_bytes(
            invoice=invoice, settings=QrSettings(logo="custom", logo_data_url=logo))
        self.assertNotEqual(plain, with_logo)

    def test_huge_dimensions_rejected_before_decoding(self):
        bomb = _data_url(Image.new("1", (10000, 10000)))
        self.assertLess(len(bomb), qr_codes.MAX_QR_LOGO_DATA_URL_LENGTH)
        with patch.object(Image.Image, "convert", side_effect=AssertionError("decoded")):
            with self.assertRaises(HTTPException) as ctx:
                qr_codes._load_logo_from_data_url(bomb)
        self.assertIn("dimensions", ctx.exception.detail)

    def test_overlong_data_url_rejected_before_base64_decode(self):
        url = "data:image/png;base64," + "A" * qr_codes.MAX_QR_LOGO_DATA_URL_LENGTH
        with patch.object(qr_codes.base64, "b64decode", side_effect=AssertionError("decoded")):
            with self.assertRaises(HTTPException) as ctx:
                qr_codes._load_logo_from_data_url(url)
        self.assertIn("too large", ctx.exception.detail)

    def test_unsupported_format_rejected(self):
        bmp = _data_url(Image.new("RGB", (32, 32)), fmt="BMP")
        with self.assertRaises(HTTPException) as ctx:
            qr_codes._load_logo_from_data_url(bmp)
        self.assertIn("not supported", ctx.exception.detail)

    def test_bad_logo_falls_back_to_cached_plain_qr(self):
        bomb = _data_url(Image.new("1", (10000, 10000)))
        invoice = _invoice()
        settings = QrSettings(logo="custom", logo_data_url=bomb)
        with tempfile.TemporaryDirectory() as storage:
            path = qr_codes.ensure_invoice_qr_png(invoice=invoice, storage_dir=storage, settings=settings)
            self.assertTrue(os.path.exists(path))
            with open(path, "rb") as f:
                written = f.read()
            plain = qr_codes.build_invoice_qr_png_bytes(invoice=invoice, settings=QrSettings(logo="none"))
            self.assertEqual(written, plain)
            with patch.object(qr_codes, "_load_logo_from_data_url", side_effect=AssertionError("re-decoded")):
                self.assertEqual(
                    qr_codes.ensure_invoice_qr_png(invoice=invoice, storage_dir=storage, settings=settings), path)


if __name__ == "__main__":
    unittest.main()
