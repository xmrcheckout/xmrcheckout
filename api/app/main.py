import logging
import os

from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse
from sqlalchemy import text

from .db import Base, engine
from .config import DONATIONS_ENABLED
from .btcpay_routes import router as btcpay_router
from .payment_links import router as payment_links_router
from .routes import router
from .allocation_diagnostics import AllocationError

app = FastAPI(title="xmrcheckout.com API", version="0.1.0")

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO").upper())


@app.exception_handler(AllocationError)
async def allocation_error_response(request, exc):
    content = {"detail": exc.detail, "code": exc.code, "diagnostic_id": exc.diagnostic_id}
    if exc.retry_after_seconds is not None:
        content["retry_after_seconds"] = exc.retry_after_seconds
    if request.url.path == "/api/core/donations":
        content = {"detail": "Donation invoice creation is unavailable. Try again later.",
                   "diagnostic_id": exc.diagnostic_id}
    return JSONResponse(content, status_code=exc.status_code,
                        headers={**(exc.headers or {}), "Cache-Control": "no-store"})


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    openapi_schema.get("paths", {}).pop("/api/core/donations", None)
    if not DONATIONS_ENABLED:
        openapi_schema.get("paths", {}).pop("/api/core/public/donation/{invoice_id}", None)
    openapi_schema.get("paths", {}).pop("/api/core/auth/validate", None)
    openapi_schema.get("paths", {}).pop("/api/core/profile", None)
    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi


@app.on_event("startup")
def startup():
    lock_acquired = False
    lock_id = 894221741
    with engine.begin() as connection:
        try:
            connection.execute(text("SELECT pg_advisory_lock(:lock_id)"), {"lock_id": lock_id})
            lock_acquired = True
        except Exception:
            lock_acquired = False
        try:
            Base.metadata.create_all(bind=connection)
            connection.execute(text("ALTER TABLE payment_links ADD COLUMN IF NOT EXISTS button_text VARCHAR(32) NOT NULL DEFAULT 'Buy with Monero'"))
            connection.execute(text("ALTER TABLE payment_links ADD COLUMN IF NOT EXISTS auto_create_invoice BOOLEAN NOT NULL DEFAULT false"))
            connection.execute(text("ALTER TABLE payment_links ADD COLUMN IF NOT EXISTS confirmation_message VARCHAR(2000)"))
            connection.execute(text("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_link_id UUID"))
            connection.execute(text("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_link_attempt_id UUID"))
            connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS invoice_payment_link_attempt ON invoices (payment_link_id, payment_link_attempt_id)"))
            connection.execute(
                text("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS user_id UUID")
            )
            connection.execute(
                text("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS wallet_address VARCHAR")
            )
            connection.execute(
                text("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subaddress_index INTEGER")
            )
            connection.execute(
                text(
                    "ALTER TABLE invoices "
                    "ADD COLUMN IF NOT EXISTS confirmations INTEGER DEFAULT 0"
                )
            )
            connection.execute(
                text(
                    "ALTER TABLE invoices "
                    "ADD COLUMN IF NOT EXISTS total_paid_atomic BIGINT"
                )
            )
            connection.execute(
                text(
                    "ALTER TABLE invoices "
                    "ADD COLUMN IF NOT EXISTS paid_after_expiry BOOLEAN DEFAULT false"
                )
            )
            connection.execute(
                text(
                    "ALTER TABLE invoices "
                    "ADD COLUMN IF NOT EXISTS paid_after_expiry_at TIMESTAMP WITH TIME ZONE"
                )
            )
            connection.execute(
                text(
                    "ALTER TABLE invoices "
                    "ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE"
                )
            )
            connection.execute(
                text("UPDATE invoices SET confirmations = 0 WHERE confirmations IS NULL")
            )
            connection.execute(
                text("CREATE INDEX IF NOT EXISTS ix_invoices_user_id ON invoices (user_id)")
            )
            connection.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_invoices_wallet_address ON invoices (wallet_address)"
                )
            )
            connection.execute(text("ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS user_id UUID"))
            connection.execute(
                text("ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS event_urls JSON")
            )
            connection.execute(
                text("ALTER TABLE webhooks ALTER COLUMN url DROP NOT NULL")
            )
            connection.execute(
                text("CREATE INDEX IF NOT EXISTS ix_webhooks_user_id ON webhooks (user_id)")
            )
            connection.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_webhook_deliveries_user_id "
                    "ON webhook_deliveries (user_id)"
                )
            )
            connection.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_webhook_deliveries_webhook_id "
                    "ON webhook_deliveries (webhook_id)"
                )
            )
            connection.execute(
                text(
                    "ALTER TABLE webhook_deliveries "
                    "ADD COLUMN IF NOT EXISTS invoice_id UUID"
                )
            )
            connection.execute(
                text(
                    "ALTER TABLE webhook_deliveries "
                    "ADD COLUMN IF NOT EXISTS invoice_address VARCHAR"
                )
            )
            connection.execute(
                text(
                    "ALTER TABLE webhook_deliveries "
                    "ADD COLUMN IF NOT EXISTS invoice_subaddress_index INTEGER"
                )
            )
            connection.execute(
                text(
                    "ALTER TABLE webhook_deliveries "
                    "ADD COLUMN IF NOT EXISTS invoice_amount_xmr NUMERIC(18, 12)"
                )
            )
            connection.execute(
                text(
                    "ALTER TABLE webhook_deliveries "
                    "ADD COLUMN IF NOT EXISTS invoice_status VARCHAR"
                )
            )
            connection.execute(
                text(
                    "ALTER TABLE webhook_deliveries "
                    "ADD COLUMN IF NOT EXISTS payload JSON"
                )
            )
            connection.execute(
                text("ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_address VARCHAR")
            )
            connection.execute(
                text("ALTER TABLE users ADD COLUMN IF NOT EXISTS view_key_encrypted VARCHAR")
            )
            connection.execute(
                text(
                    "ALTER TABLE users "
                    "ADD COLUMN IF NOT EXISTS webhook_secret_encrypted VARCHAR"
                )
            )
            connection.execute(
                text(
                    "ALTER TABLE users "
                    "ADD COLUMN IF NOT EXISTS next_subaddress_index INTEGER DEFAULT 1"
                )
            )
            connection.execute(
                text(
                    "ALTER TABLE users "
                    "ADD COLUMN IF NOT EXISTS subaddress_start_index INTEGER DEFAULT 0"
                )
            )
            connection.execute(
                    text(
                        "ALTER TABLE users "
                        "ADD COLUMN IF NOT EXISTS default_confirmation_target INTEGER DEFAULT 1"
                    )
                )
            connection.execute(
                text(
                    "ALTER TABLE users "
                    "ALTER COLUMN default_confirmation_target SET DEFAULT 1"
                )
            )
            connection.execute(
                text(
                    "ALTER TABLE users "
                    "ADD COLUMN IF NOT EXISTS default_qr_logo VARCHAR DEFAULT 'monero'"
                )
            )
            connection.execute(
                text(
                    "ALTER TABLE users "
                    "ADD COLUMN IF NOT EXISTS default_qr_logo_data_url VARCHAR"
                )
            )
            connection.execute(
                text(
                    "ALTER TABLE users "
                    "ADD COLUMN IF NOT EXISTS btcpay_checkout_style VARCHAR DEFAULT 'btcpay_classic'"
                )
            )
            connection.execute(
                text(
                    "ALTER TABLE users "
                    "ALTER COLUMN btcpay_checkout_style SET DEFAULT 'btcpay_classic'"
                )
            )
            connection.execute(
                text(
                    "ALTER TABLE users "
                    "ADD COLUMN IF NOT EXISTS invoice_creation_window_started_at "
                    "TIMESTAMP WITH TIME ZONE"
                )
            )
            connection.execute(
                text(
                    "ALTER TABLE users "
                    "ADD COLUMN IF NOT EXISTS invoice_creation_count "
                    "INTEGER NOT NULL DEFAULT 0"
                )
            )
            connection.execute(
                text(
                    "UPDATE users SET invoice_creation_count = 0 "
                    "WHERE invoice_creation_count IS NULL"
                )
            )
            connection.execute(
                text(
                    "ALTER TABLE users "
                    "ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()"
                )
            )
            connection.execute(
                text(
                    "UPDATE users SET btcpay_checkout_style = 'btcpay_classic' "
                    "WHERE btcpay_checkout_style IS NULL"
                )
            )
            connection.execute(
                text(
                    "UPDATE users "
                    "SET btcpay_checkout_style = 'btcpay_classic' "
                    "WHERE btcpay_checkout_style = 'standard' "
                    "AND NOT EXISTS ("
                    "  SELECT 1 FROM profile_history ph "
                    "  WHERE ph.user_id = users.id AND ph.field_name = 'btcpay_checkout_style'"
                    ")"
                )
            )
            connection.execute(
                text(
                    "UPDATE users SET default_confirmation_target = 1 "
                    "WHERE default_confirmation_target IS NULL"
                )
            )
            connection.execute(
                text(
                    "UPDATE users SET default_qr_logo = 'monero' "
                    "WHERE default_qr_logo IS NULL"
                )
            )
            connection.execute(
                text("CREATE INDEX IF NOT EXISTS ix_users_payment_address ON users (payment_address)")
            )
            connection.execute(
                text(
                    "CREATE TABLE IF NOT EXISTS system_status ("
                    "name VARCHAR PRIMARY KEY, "
                    "last_reconcile_started_at TIMESTAMP WITH TIME ZONE, "
                    "last_reconcile_completed_at TIMESTAMP WITH TIME ZONE, "
                    "last_reconcile_error VARCHAR, "
                    "wallet_rpc VARCHAR, "
                    "daemon VARCHAR, "
                    "daemon_height INTEGER, "
                    "checked_at TIMESTAMP WITH TIME ZONE, "
                    "updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()"
                    ")"
                )
            )
            connection.execute(
                text(
                    "ALTER TABLE system_status "
                    "ADD COLUMN IF NOT EXISTS last_reconcile_started_at TIMESTAMP WITH TIME ZONE"
                )
            )
            connection.execute(
                text(
                    "ALTER TABLE system_status "
                    "ADD COLUMN IF NOT EXISTS last_reconcile_completed_at TIMESTAMP WITH TIME ZONE"
                )
            )
            connection.execute(
                text(
                    "ALTER TABLE system_status "
                    "ADD COLUMN IF NOT EXISTS last_reconcile_error VARCHAR"
                )
            )
            connection.execute(
                text(
                    "ALTER TABLE system_status "
                    "ADD COLUMN IF NOT EXISTS last_reconcile_attempted_invoices "
                    "INTEGER NOT NULL DEFAULT 0"
                )
            )
            connection.execute(
                text(
                    "ALTER TABLE system_status "
                    "ADD COLUMN IF NOT EXISTS last_reconcile_succeeded_invoices "
                    "INTEGER NOT NULL DEFAULT 0"
                )
            )
            connection.execute(
                text(
                    "ALTER TABLE system_status "
                    "ADD COLUMN IF NOT EXISTS last_reconcile_failed_invoices "
                    "INTEGER NOT NULL DEFAULT 0"
                )
            )
            connection.execute(
                text(
                    "ALTER TABLE system_status "
                    "ADD COLUMN IF NOT EXISTS wallet_rpc VARCHAR"
                )
            )
            connection.execute(
                text(
                    "ALTER TABLE system_status "
                    "ADD COLUMN IF NOT EXISTS daemon VARCHAR"
                )
            )
            connection.execute(
                text(
                    "ALTER TABLE system_status "
                    "ADD COLUMN IF NOT EXISTS daemon_height INTEGER"
                )
            )
            connection.execute(
                text(
                    "ALTER TABLE system_status "
                    "ADD COLUMN IF NOT EXISTS checked_at TIMESTAMP WITH TIME ZONE"
                )
            )
            connection.execute(
                text(
                    "ALTER TABLE system_status "
                    "ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()"
                )
            )
            connection.execute(
                text(
                    "INSERT INTO system_status (name) VALUES ('reconciler') "
                    "ON CONFLICT (name) DO NOTHING"
                )
            )
            connection.execute(
                text(
                    "INSERT INTO system_status (name) VALUES ('monero_connectivity') "
                    "ON CONFLICT (name) DO NOTHING"
                )
            )
        finally:
            if lock_acquired:
                connection.execute(
                    text("SELECT pg_advisory_unlock(:lock_id)"), {"lock_id": lock_id}
                )


app.include_router(router)
app.include_router(btcpay_router)

app.include_router(payment_links_router)
