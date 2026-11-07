from pathlib import Path
import subprocess
import tempfile
import unittest


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
REPAIR_PATH = REPOSITORY_ROOT / "docker" / "monero" / "repair-wallet-caches.sh"


class WalletCacheRepairTests(unittest.TestCase):
    def test_zero_cache_is_quarantined_and_keys_are_untouched(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            wallet_dir = Path(temporary_directory)
            keys = wallet_dir / "user-a-fingerprint.keys"
            cache = wallet_dir / "user-a-fingerprint"
            artifact = wallet_dir / "user-a-fingerprint.unportable"
            healthy_cache = wallet_dir / "user-b-fingerprint"
            keys.write_bytes(b"view-only-keys")
            cache.touch()
            artifact.touch()
            (wallet_dir / "user-b-fingerprint.keys").write_bytes(b"other-keys")
            healthy_cache.write_bytes(b"healthy-cache")

            result = subprocess.run(
                ["sh", str(REPAIR_PATH), str(wallet_dir)],
                check=False,
                capture_output=True,
                text=True,
            )

            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(keys.read_bytes(), b"view-only-keys")
            self.assertFalse(cache.exists())
            self.assertFalse(artifact.exists())
            self.assertEqual(healthy_cache.read_bytes(), b"healthy-cache")
            quarantined = list((wallet_dir / ".quarantine").glob("*/*"))
            self.assertEqual(len(quarantined), 2)

    def test_empty_keys_file_stops_startup_repair(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            wallet_dir = Path(temporary_directory)
            (wallet_dir / "user-a-fingerprint.keys").touch()
            result = subprocess.run(
                ["sh", str(REPAIR_PATH), str(wallet_dir)],
                check=False,
                capture_output=True,
                text=True,
            )
            self.assertNotEqual(result.returncode, 0)


if __name__ == "__main__":
    unittest.main()
