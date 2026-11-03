"""Configuration guards for invoice address reuse."""
import os
import subprocess
import sys
import unittest
from pathlib import Path

API_DIR = Path(__file__).resolve().parents[1]


def import_config(**env):
    return subprocess.run(
        [sys.executable, "-c", "import app.config as c; print(c.SUBADDRESS_REUSE_COOLDOWN_SECONDS)"],
        cwd=API_DIR, env={**os.environ, **env}, capture_output=True, text=True,
    )


class SubaddressConfigTests(unittest.TestCase):
    def test_default_cooldown_is_three_days(self):
        env = {k: v for k, v in os.environ.items() if k != "SUBADDRESS_REUSE_COOLDOWN_SECONDS"}
        result = subprocess.run(
            [sys.executable, "-c", "import app.config as c; print(c.SUBADDRESS_REUSE_COOLDOWN_SECONDS)"],
            cwd=API_DIR, env={**env, "LATE_PAYMENT_LOOKBACK_HOURS": "48"}, capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), "259200")

    def test_cooldown_must_exceed_late_payment_window(self):
        for cooldown in ("172800", "3600"):
            with self.subTest(cooldown=cooldown):
                result = import_config(SUBADDRESS_REUSE_COOLDOWN_SECONDS=cooldown,
                                       LATE_PAYMENT_LOOKBACK_HOURS="48")
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("LATE_PAYMENT_LOOKBACK_HOURS", result.stderr)
        result = import_config(SUBADDRESS_REUSE_COOLDOWN_SECONDS="172801", LATE_PAYMENT_LOOKBACK_HOURS="48")
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
