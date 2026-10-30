"""Allowlisted diagnostics; never serialize exception text or RPC payloads."""
import json
import logging
from datetime import datetime, timezone

from fastapi import HTTPException
from monero.backends.jsonrpc.exceptions import RPCError
from requests import RequestException
from sqlalchemy import update
from sqlalchemy.dialects.postgresql import insert

from .models import SnapshotStatus

logger = logging.getLogger(__name__)


class AllocationError(HTTPException):
    def __init__(self, status_code, detail, code, diagnostic_id, retry_after_seconds=None):
        super().__init__(status_code, detail, headers=(
            {"Retry-After": str(retry_after_seconds)} if retry_after_seconds is not None else None))
        self.code = code
        self.diagnostic_id = str(diagnostic_id)
        self.retry_after_seconds = retry_after_seconds


def log_event(event, *, user_id, attempt_id, reason_code, duration_ms, index=None, **safe_fields):
    fields = dict(event=event, merchant_id=str(user_id), diagnostic_id=str(attempt_id),
                  reason_code=reason_code, duration_ms=duration_ms)
    if index is not None:
        fields["subaddress_index"] = index
    fields.update({key: value for key, value in safe_fields.items()
                   if key in ("rpc_error_code", "cutoff_height", "exclusion_count")})
    logger.log(logging.INFO if reason_code == "snapshot_succeeded" else logging.WARNING,
               json.dumps(fields, sort_keys=True))


def failure_category(exc):
    known = {
        "Monero wallet RPC is busy": "wallet_busy",
        "View-only wallet is still syncing": "wallet_syncing",
        "Monero daemon height is unavailable": "daemon_unavailable",
        "Wallet RPC cannot reach the Monero daemon": "daemon_unavailable",
        "Monero wallet RPC is unreachable": "wallet_unavailable",
        "Monero wallet RPC is busy or unreachable": "wallet_unavailable",
        "Incomplete incoming transfer snapshot": "incomplete_snapshot",
        "Incomplete confirmed transfer snapshot": "incomplete_snapshot",
        "Monero wallet RPC returned a malformed transfer response": "incomplete_snapshot",
        "Monero wallet RPC did not return an address index": "incomplete_snapshot",
    }
    category = known.get(exc.detail, "snapshot_unavailable") if isinstance(exc, HTTPException) and isinstance(exc.detail, str) else "snapshot_unavailable"
    code = None
    seen = set()
    while exc is not None and id(exc) not in seen:
        seen.add(id(exc))
        if isinstance(exc, RPCError):
            category = "rpc_error" if category == "snapshot_unavailable" else category
            error = getattr(exc, "error", None)
            value = error.get("code") if isinstance(error, dict) else None
            code = value if type(value) is int else None
        elif isinstance(exc, RequestException) and category == "snapshot_unavailable":
            category = "wallet_unavailable"
        exc = exc.__cause__ or exc.__context__
    return category, code


def persist_snapshot(db, *, user_id, attempt_id, attempted_at, outcome="running",
                     duration_ms=None, failure=None):
    """Use a separate connection/transaction, never the invoice transaction."""
    try:
        bind = db.get_bind()
        engine = getattr(bind, "engine", bind)
        with engine.begin() as connection:
            # Bound diagnostic writes so an operator storage issue cannot stall creation.
            connection.exec_driver_sql("SET LOCAL statement_timeout = '2000ms'")
            if outcome == "running":
                values = dict(user_id=user_id, attempt_id=attempt_id, attempted_at=attempted_at,
                              outcome=outcome, completed_at=None, duration_ms=None, failure_category=None)
                statement = insert(SnapshotStatus).values(**values)
                connection.execute(statement.on_conflict_do_update(
                    index_elements=[SnapshotStatus.user_id],
                    set_={key: value for key, value in values.items() if key != "user_id"}))
            else:
                completed = datetime.now(timezone.utc)
                values = dict(outcome=outcome, completed_at=completed, duration_ms=duration_ms,
                              failure_category=failure)
                if outcome == "succeeded":
                    values["last_success_at"] = completed
                connection.execute(update(SnapshotStatus).where(
                    SnapshotStatus.user_id == user_id, SnapshotStatus.attempt_id == attempt_id).values(**values))
    except Exception:
        logger.error(json.dumps(dict(event="snapshot_diagnostic_write_failed", merchant_id=str(user_id),
                                     diagnostic_id=str(attempt_id), reason_code="diagnostic_storage_unavailable")))
