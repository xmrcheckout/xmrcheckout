import unittest
from types import SimpleNamespace

from app.monero_service import MoneroWalletService

XMR = 1_000_000_000_000


def _transfer(txid, **extra):
    item = {"txid": txid, "amount": XMR, "confirmations": 12, "height": 3_000_000,
            "timestamp": 1_700_000_000, "address": "addr"}
    item.update(extra)
    return item


class TimeLockedTransferTests(unittest.TestCase):
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

    def test_far_future_unlock_time_is_ignored(self):
        txids, total = self.read([_transfer("a" * 64, unlock_time=9_000_000_000, locked=True)])
        self.assertEqual(txids, [])
        self.assertEqual(total, 0)

    def test_standard_lock_still_counts(self):
        txids, total = self.read([_transfer("b" * 64, unlock_time=0, locked=True)])
        self.assertEqual(txids, ["b" * 64])
        self.assertEqual(total, XMR)

    def test_missing_unlock_time_counts(self):
        txids, total = self.read([_transfer("c" * 64)])
        self.assertEqual(txids, ["c" * 64])
        self.assertEqual(total, XMR)

    def test_time_locked_pool_transfer_is_ignored(self):
        txids, total = self.read(pool=[_transfer("d" * 64, confirmations=0, height=0,
                                                 unlock_time=3_100_000)])
        self.assertEqual(txids, [])
        self.assertEqual(total, 0)

    def test_non_integer_unlock_time_is_ignored(self):
        txids, _ = self.read([_transfer("e" * 64, unlock_time="0")])
        self.assertEqual(txids, [])


if __name__ == "__main__":
    unittest.main()
