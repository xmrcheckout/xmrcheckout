import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi import HTTPException
from monero.seed import Seed

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
                patch.object(routes, "_validate_payment_address_and_view_key", return_value="b" * 64):
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


# Order of the ed25519 base point group.
GROUP_ORDER = 2**252 + 27742317777372353535851937790883648493


def _encrypted(value):
    return f"enc:{value}"


class ViewKeyFormTests(unittest.TestCase):
    """Only the standard form of a view key is accepted; it decides invoice addresses."""

    @classmethod
    def setUpClass(cls):
        seed = Seed()
        cls.address = str(seed.public_address())
        cls.view_key = seed.secret_view_key()
        key = bytes.fromhex(cls.view_key)
        top_bit = bytearray(key)
        top_bit[31] |= 0x80
        cls.other_forms = {
            "plus group order": (int.from_bytes(key, "little") + GROUP_ORDER).to_bytes(32, "little").hex(),
            "top bit set": bytes(top_bit).hex(),
            "too long": cls.view_key + "00",
            "not hex": "z" * 64,
        }

    def login(self, typed, stored):
        user = SimpleNamespace(id="store-1", view_key_encrypted="enc", api_key_encrypted="key")
        db = _db(user)
        payload = LoginRequest(payment_address=self.address, view_key=typed)
        with patch.object(routes, "decrypt_secret", return_value=stored), \
                patch.object(routes, "encrypt_secret", side_effect=_encrypted), \
                patch.object(routes, "decrypt_api_key", return_value="api-key"), \
                patch.object(routes, "_ensure_webhook_secret", return_value="secret"):
            routes.login_user(payload, db)
        return user, db

    def test_standard_key_is_returned_in_lowercase(self):
        typed = f" {self.view_key.upper()} "
        self.assertEqual(routes._validate_payment_address_and_view_key(self.address, typed), self.view_key)

    def test_other_forms_of_the_key_are_rejected(self):
        for name, value in self.other_forms.items():
            with self.subTest(name), self.assertRaises(HTTPException) as ctx:
                routes._validate_payment_address_and_view_key(self.address, value)
            self.assertEqual(ctx.exception.status_code, 400)

    def test_login_with_another_form_leaves_the_stored_key_alone(self):
        for name in ("plus group order", "top bit set"):
            with self.subTest(name):
                user = SimpleNamespace(id="store-1", view_key_encrypted="enc", api_key_encrypted="key")
                db = _db(user)
                payload = LoginRequest(payment_address=self.address, view_key=self.other_forms[name])
                with patch.object(routes, "decrypt_secret", return_value=self.view_key), \
                        self.assertRaises(HTTPException) as ctx:
                    routes.login_user(payload, db)
                self.assertEqual(ctx.exception.status_code, 400)
                self.assertEqual(user.view_key_encrypted, "enc")
                db.commit.assert_not_called()

    def test_letter_case_never_rewrites_the_stored_key(self):
        for stored, typed in ((self.view_key, self.view_key.upper()), (self.view_key.upper(), self.view_key)):
            with self.subTest(stored=stored[:6]):
                user, db = self.login(typed, stored)
                self.assertEqual(user.view_key_encrypted, "enc")
                db.add.assert_not_called()

    def test_stored_non_standard_key_is_replaced_by_the_standard_one(self):
        user, db = self.login(self.view_key, self.other_forms["plus group order"])
        self.assertEqual(user.view_key_encrypted, _encrypted(self.view_key))
        db.commit.assert_called()

    def test_new_account_stores_the_key_in_lowercase(self):
        db = _db(None)
        payload = LoginRequest(payment_address=self.address, view_key=self.view_key.upper())
        with patch.object(routes, "SIGNUP_ENABLED", True), \
                patch.object(routes, "encrypt_secret", side_effect=_encrypted), \
                patch.object(routes, "encrypt_api_key", return_value="enc"):
            routes.login_user(payload, db)
        self.assertEqual(db.add.call_args.args[0].view_key_encrypted, _encrypted(self.view_key))

    def test_founder_key_case_does_not_rewrite_the_stored_key(self):
        user = SimpleNamespace(id="founder", view_key_encrypted="enc")
        db = _db(user)
        with patch.object(routes, "FOUNDER_PAYMENT_ADDRESS", self.address), \
                patch.object(routes, "FOUNDER_VIEW_KEY", self.view_key.upper()), \
                patch.object(routes, "decrypt_secret", return_value=self.view_key), \
                patch.object(routes, "_ensure_webhook_secret", return_value="secret"):
            self.assertIs(routes._get_founder_user(db), user)
        self.assertEqual(user.view_key_encrypted, "enc")
        db.commit.assert_not_called()


if __name__ == "__main__":
    unittest.main()
