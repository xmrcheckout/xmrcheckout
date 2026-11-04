import unittest
from types import SimpleNamespace

from app.monero_service import MoneroWalletService

XMR = 1_000_000_000_000


def _transfer(txid, **extra):
    item = {"txid": txid, "amount": XMR, "confirmations": 0, "height": 0,
            "timestamp": 1_700_000_000, "address": "addr", "unlock_time": 0}
    item.update(extra)
    return item


class DoubleSpendTransferTests(unittest.TestCase):
    def read(self, incoming=(), pool=()):
        service = object.__new__(MoneroWalletService)
        responses = {
            "get_address_index": {"index": {"major": 0, "minor": 5}},
            "get_transfers": {"in": list(incoming), "pool": list(pool)},
        }
        backend = SimpleNamespace(client=SimpleNamespace(
            raw_request=lambda method, params=None: responses[method]))
        transfers = service._get_transfers_for_address_locked(backend, "addr")
        total, _ = service._get_received_atomic_locked(backend, "addr")
        return [t.txid for t in transfers], total

    def test_flagged_pool_transfer_is_ignored(self):
        txids, total = self.read(pool=[_transfer("a" * 64, double_spend_seen=True)])
        self.assertEqual(txids, [])
        self.assertEqual(total, 0)

    def test_unflagged_pool_transfer_counts(self):
        txids, total = self.read(pool=[_transfer("b" * 64, double_spend_seen=False)])
        self.assertEqual(txids, ["b" * 64])
        self.assertEqual(total, XMR)

    def test_pool_transfer_without_flag_counts(self):
        txids, total = self.read(pool=[_transfer("c" * 64)])
        self.assertEqual(txids, ["c" * 64])
        self.assertEqual(total, XMR)

    def test_flag_on_confirmed_transfer_is_ignored(self):
        txids, total = self.read([_transfer("d" * 64, confirmations=12, height=3_000_000,
                                            double_spend_seen=True)])
        self.assertEqual(txids, ["d" * 64])
        self.assertEqual(total, XMR)


if __name__ == "__main__":
    unittest.main()
