import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

from app import routes
from app.schemas import LoginRequest

ADDRESS = "4" + "A" * 94


def _db(existing):
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = existing
    return db


class SignupSwitchTests(unittest.TestCase):
    def login(self, db, enabled):
        payload = LoginRequest(payment_address=ADDRESS, view_key="b" * 64)
        with patch.object(routes, "SIGNUP_ENABLED", enabled), \
                patch.object(routes, "_validate_payment_address_and_view_key"):
            return routes.login_user(payload, db)

    def test_closed_signup_rejects_new_wallet_without_creating_it(self):
        db = _db(None)
        with self.assertRaises(HTTPException) as ctx:
            self.login(db, enabled=False)
        self.assertEqual(ctx.exception.status_code, 403)
        db.add.assert_not_called()
        db.commit.assert_not_called()

    def test_closed_signup_still_lets_existing_merchant_log_in(self):
        user = SimpleNamespace(id="store-1", view_key_encrypted="enc", api_key_encrypted="key")
        with patch.object(routes, "decrypt_secret", return_value="b" * 64), \
                patch.object(routes, "decrypt_api_key", return_value="api-key"), \
                patch.object(routes, "_ensure_webhook_secret", return_value="secret"):
            result = self.login(_db(user), enabled=False)
        self.assertEqual(result["api_key"], "api-key")

    def test_open_signup_creates_new_wallet(self):
        db = _db(None)
        with patch.object(routes, "encrypt_secret", return_value="enc"), \
                patch.object(routes, "encrypt_api_key", return_value="enc"):
            result = self.login(db, enabled=True)
        db.add.assert_called_once()
        self.assertIn("api_key", result)


if __name__ == "__main__":
    unittest.main()
