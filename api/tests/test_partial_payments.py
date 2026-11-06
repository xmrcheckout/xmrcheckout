import os
import unittest
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

from app import btcpay_routes, btcpay_webhooks, reconciler, webhooks
from app import subaddress_status as status
from app.monero_service import TransferDetail
from test_reconciler import _FakeDb, _pending_invoice

XMR = 1_000_000_000_000
USER = SimpleNamespace(
    id="user-1",
    payment_address="merchant-address",
    view_key_encrypted="encrypted-view-key",
)


class _Service:
    def __init__(self, transfers):
        self.transfers = transfers

    def get_transfers_for_address(self, *, user, address):
        return list(self.transfers)


def _reconcile(invoice, transfers):
    db = _FakeDb([invoice], USER)
    with (
        patch.object(reconciler, "dispatch_webhooks") as native,
        patch.object(reconciler, "dispatch_btcpay_webhooks") as btcpay,
    ):
        ok = reconciler._reconcile_invoice(db, _Service(transfers), USER, invoice)
    assert ok
    # Detection only queues webhooks; the delivery loop sends them.
    for call in native.call_args_list + btcpay.call_args_list:
        assert call.kwargs.get("queue") is True, call
    return (
        [call.args[2] for call in native.call_args_list],
        [call.args[2] for call in btcpay.call_args_list],
    )


def _transfer(txid, amount, confirmations=0):
    return TransferDetail(txid, amount, confirmations, None, "address-partial")


class PartialPaymentReconcileTests(unittest.TestCase):
    def setUp(self):
        self.invoice = _pending_invoice("partial", USER.id)

    def test_underpayment_before_expiry_is_partially_paid_and_signalled(self):
        native, btcpay = _reconcile(self.invoice, [_transfer("a", XMR // 2)])
        self.assertEqual(self.invoice.status, "partially_paid")
        self.assertEqual(self.invoice.total_paid_atomic, XMR // 2)
        self.assertEqual(native, ["invoice.partially_paid"])
        self.assertEqual(btcpay, ["InvoiceReceivedPayment"])

    def test_unchanged_partial_amount_is_not_resignalled(self):
        _reconcile(self.invoice, [_transfer("a", XMR // 2)])
        native, btcpay = _reconcile(self.invoice, [_transfer("a", XMR // 2)])
        self.assertEqual(self.invoice.status, "partially_paid")
        self.assertEqual((native, btcpay), ([], []))

    def test_additional_partial_top_up_is_resignalled(self):
        _reconcile(self.invoice, [_transfer("a", XMR // 4)])
        native, btcpay = _reconcile(
            self.invoice, [_transfer("a", XMR // 4), _transfer("b", XMR // 4)]
        )
        self.assertEqual(self.invoice.status, "partially_paid")
        self.assertEqual(native, ["invoice.partially_paid"])
        self.assertEqual(btcpay, ["InvoiceReceivedPayment"])

    def test_top_up_to_full_amount_detects_payment(self):
        _reconcile(self.invoice, [_transfer("a", XMR // 2)])
        native, btcpay = _reconcile(
            self.invoice, [_transfer("a", XMR // 2), _transfer("b", XMR // 2)]
        )
        self.assertEqual(self.invoice.status, "payment_detected")
        self.assertEqual(native, ["invoice.payment_detected"])
        self.assertEqual(
            btcpay,
            ["InvoiceReceivedPayment", "InvoicePaidInFull", "InvoiceProcessing"],
        )

    def test_partially_paid_invoice_expires(self):
        _reconcile(self.invoice, [_transfer("a", XMR // 2)])
        self.invoice.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        native, btcpay = _reconcile(self.invoice, [_transfer("a", XMR // 2)])
        self.assertEqual(self.invoice.status, "expired")
        self.assertEqual(native, ["invoice.expired"])
        self.assertEqual(btcpay, ["InvoiceExpired"])

    def test_underpayment_found_after_expiry_expires_directly(self):
        self.invoice.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        native, _ = _reconcile(self.invoice, [_transfer("a", XMR // 2)])
        self.assertEqual(self.invoice.status, "expired")
        self.assertEqual(native, ["invoice.expired"])

    def test_late_top_up_of_expired_underpaid_invoice_is_detected(self):
        _reconcile(self.invoice, [_transfer("a", XMR // 2)])
        self.invoice.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        _reconcile(self.invoice, [_transfer("a", XMR // 2)])
        native, _ = _reconcile(
            self.invoice, [_transfer("a", XMR // 2), _transfer("b", XMR // 2)]
        )
        self.assertEqual(self.invoice.status, "payment_detected")
        self.assertEqual(native, ["invoice.payment_detected"])

    def test_vanished_partial_payment_returns_to_pending_quietly(self):
        _reconcile(self.invoice, [_transfer("a", XMR // 2)])
        # Non-empty wallet response that no longer includes a positive transfer.
        native, btcpay = _reconcile(self.invoice, [_transfer("z", 0)])
        self.assertEqual(self.invoice.status, "pending")
        self.assertEqual((native, btcpay), ([], []))


def _invoice(paid_atomic, state="partially_paid"):
    return SimpleNamespace(
        id="00000000-0000-0000-0000-000000000001",
        address="address-1",
        subaddress_index=1,
        amount_xmr=Decimal("1"),
        total_paid_atomic=paid_atomic,
        status=state,
        confirmation_target=1,
        confirmations=0,
        paid_after_expiry=False,
        paid_after_expiry_at=None,
        metadata_json=None,
        created_at=None,
        expires_at=None,
        detected_at=None,
        confirmed_at=None,
    )


class PartialPaymentPayloadTests(unittest.TestCase):
    def test_native_payload_includes_paid_and_remaining_amounts(self):
        payload = webhooks.build_webhook_payload(
            "invoice.partially_paid", _invoice(XMR // 4)
        )
        self.assertEqual(payload["invoice"]["amount_paid_xmr"], "0.25")
        self.assertEqual(payload["invoice"]["amount_remaining_xmr"], "0.75")
        self.assertEqual(payload["invoice"]["status"], "partially_paid")

    def test_native_payload_includes_invoice_and_receipt_urls(self):
        invoice = _invoice(XMR, "confirmed")
        with patch.dict(os.environ, {"SITE_URL": "https://shop.example/"}):
            payload = webhooks.build_webhook_payload("invoice.confirmed", invoice)
        self.assertEqual(
            payload["invoice"]["invoice_url"],
            f"https://shop.example/invoice/{invoice.id}",
        )
        self.assertEqual(
            payload["invoice"]["receipt_url"],
            f"https://shop.example/i/{invoice.id}/receipt",
        )

    def test_btcpay_payload_links_to_btcpay_payment_page(self):
        invoice = _invoice(XMR, "confirmed")
        invoice.metadata_json = {"btcpay": {"amount": "10", "currency": "EUR"}}
        with patch.dict(os.environ, {"SITE_URL": "https://shop.example/"}):
            payload = webhooks.build_webhook_payload("invoice.confirmed", invoice)
        self.assertEqual(
            payload["invoice"]["invoice_url"],
            f"https://shop.example/i/{invoice.id}",
        )
        self.assertEqual(
            payload["invoice"]["receipt_url"],
            f"https://shop.example/i/{invoice.id}/receipt",
        )

    def test_overpayment_has_no_remaining_amount(self):
        payload = webhooks.build_webhook_payload(
            "invoice.payment_detected", _invoice(XMR + 1, "payment_detected")
        )
        self.assertEqual(payload["invoice"]["amount_remaining_xmr"], "0")

    def test_btcpay_payload_flags_partial_and_overpayment(self):
        def build(invoice):
            return btcpay_webhooks._build_payload(
                event_type="InvoiceReceivedPayment",
                user_id="user-1",
                invoice=invoice,
                manually_marked=False,
            )

        partial = build(_invoice(XMR // 2))
        self.assertTrue(partial["partiallyPaid"])
        self.assertFalse(partial["overPaid"])
        over = build(_invoice(XMR + 1, "payment_detected"))
        self.assertFalse(over["partiallyPaid"])
        self.assertTrue(over["overPaid"])
        exact = build(_invoice(XMR, "payment_detected"))
        self.assertFalse(exact["partiallyPaid"])
        self.assertFalse(exact["overPaid"])

    def test_btcpay_status_for_partially_paid_is_new_paid_partial(self):
        self.assertEqual(
            btcpay_routes._btcpay_status(_invoice(XMR // 2)), ("New", "PaidPartial")
        )
        self.assertEqual(
            btcpay_routes._btcpay_status(_invoice(XMR // 2, "expired")),
            ("Expired", "PaidPartial"),
        )


class PartialPaymentAddressReuseTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime.now(timezone.utc)
        self.user = SimpleNamespace(
            subaddress_start_index=0,
            payment_address="fixture-address",
            view_key_encrypted="fixture-secret",
        )
        for item in (
            patch.object(status, "decrypt_secret", return_value="fixture-view-key"),
            patch.object(
                status,
                "derive_subaddress",
                side_effect=lambda **kw: f"address-{kw['address_index']}",
            ),
            patch.object(status, "MAX_SUBADDRESS_INDEX", 2),
        ):
            item.start()
            self.addCleanup(item.stop)

    def _row(self, expires_at):
        invoice = SimpleNamespace(
            id="invoice-1",
            address="address-1",
            subaddress_index=1,
            status="partially_paid",
            expires_at=expires_at,
            confirmed_at=None,
            archived_at=None,
        )
        return status.availability(self.user, [invoice], [], self.now)[0]

    def test_partially_paid_invoice_reserves_its_address(self):
        row = self._row(self.now + timedelta(hours=1))
        self.assertEqual((row.category, row.code), ("reserved", "active_invoice"))

    def test_partially_paid_past_expiry_awaits_status_update(self):
        row = self._row(self.now - timedelta(seconds=1))
        self.assertEqual(
            (row.category, row.code), ("reserved", "awaiting_invoice_status_update")
        )

    def test_partially_paid_blocks_reuse_cooldown(self):
        self.assertIsNone(
            status.reuse_ready_at([SimpleNamespace(status="partially_paid")])
        )


class VanishedPaymentTests(unittest.TestCase):
    def setUp(self):
        self.invoice = _pending_invoice("vanish", USER.id)
        native, _ = _reconcile(self.invoice, [_transfer("tx", XMR)])
        self.assertEqual(self.invoice.status, "payment_detected")
        self.assertIsNotNone(self.invoice.detected_at)

    def test_vanished_payment_after_expiry_expires_and_notifies(self):
        self.invoice.expires_at = datetime.now(timezone.utc) - timedelta(days=5)
        native, btcpay = _reconcile(self.invoice, [])
        self.assertEqual(self.invoice.status, "expired")
        self.assertEqual(self.invoice.total_paid_atomic, 0)
        self.assertIsNone(self.invoice.detected_at)
        self.assertEqual(native, ["invoice.expired"])
        self.assertEqual(btcpay, ["InvoiceExpired"])

    def test_vanished_payment_before_expiry_returns_to_pending_silently(self):
        native, btcpay = _reconcile(self.invoice, [])
        self.assertEqual(self.invoice.status, "pending")
        self.assertIsNone(self.invoice.detected_at)
        self.assertEqual((native, btcpay), ([], []))

    def test_vanished_payment_leaving_smaller_transfer_is_partially_paid(self):
        native, btcpay = _reconcile(self.invoice, [_transfer("small", XMR // 4)])
        self.assertEqual(self.invoice.status, "partially_paid")
        self.assertEqual(self.invoice.total_paid_atomic, XMR // 4)
        self.assertEqual((native, btcpay), ([], []))

    def test_reappearing_payment_is_detected_again(self):
        _reconcile(self.invoice, [])
        native, _ = _reconcile(self.invoice, [_transfer("tx", XMR)])
        self.assertEqual(self.invoice.status, "payment_detected")
        self.assertIsNotNone(self.invoice.detected_at)
        self.assertEqual(native, ["invoice.payment_detected"])

    def test_still_present_payment_stays_detected(self):
        native, btcpay = _reconcile(self.invoice, [_transfer("tx", XMR)])
        self.assertEqual(self.invoice.status, "payment_detected")
        self.assertEqual((native, btcpay), ([], []))


if __name__ == "__main__":
    unittest.main()
