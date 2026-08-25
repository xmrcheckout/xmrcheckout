import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
MIGRATION_PATH = REPOSITORY_ROOT / "scripts" / "migrate_wallet_shards.py"
REPAIR_PATH = REPOSITORY_ROOT / "docker" / "monero" / "repair-wallet-caches.sh"

spec = importlib.util.spec_from_file_location("migrate_wallet_shards", MIGRATION_PATH)
migration = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(migration)


class WalletShardMigrationTests(unittest.TestCase):
    def test_migration_routes_each_wallet_to_exactly_one_shard(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            source = root / "shared"
            source.mkdir()
            wallet_names = ["user-a-fingerprint", "user-b-fingerprint"]
            for wallet_name in wallet_names:
                (source / f"{wallet_name}.keys").write_bytes(b"keys")
                (source / wallet_name).write_bytes(b"cache")

            result = migration.migrate(source, root, "reconciler", 3)

            self.assertEqual(result["wallets"], 2)
            for wallet_name in wallet_names:
                expected = root / f"reconciler-{migration.shard_index(wallet_name, 3) + 1}"
                self.assertTrue((expected / f"{wallet_name}.keys").exists())
                matches = list(root.glob(f"reconciler-*/{wallet_name}.keys"))
                self.assertEqual(len(matches), 1)
            self.assertTrue(all(path.exists() for path in source.iterdir()))

    def test_migration_refuses_empty_keys_file(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            source = Path(temporary_directory) / "shared"
            source.mkdir()
            (source / "user-a-fingerprint.keys").touch()
            with self.assertRaisesRegex(ValueError, "keys file"):
                migration.wallet_groups(source)


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
