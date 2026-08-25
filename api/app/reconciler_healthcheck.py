from __future__ import annotations

from .db import SessionLocal
from .models import SystemStatus
from .routes import _reconciler_state


def main() -> int:
    db = SessionLocal()
    try:
        status = (
            db.query(SystemStatus)
            .filter(SystemStatus.name == "reconciler")
            .first()
        )
        return 0 if _reconciler_state(status) == "ok" else 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
