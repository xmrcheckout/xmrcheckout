import logging
import os

from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi
from sqlalchemy import text

from .db import Base, engine
from .config import DONATIONS_ENABLED
from .btcpay_routes import router as btcpay_router
from .routes import router

app = FastAPI(title="xmrcheckout.com API", version="0.1.0")

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO").upper())


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
                    "ADD COLUMN IF NOT EXISTS default_confirmation_target INTEGER DEFAULT 10"
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
                    "ADD COLUMN IF NOT EXISTS btcpay_checkout_style VARCHAR DEFAULT 'standard'"
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
                    "UPDATE users SET btcpay_checkout_style = 'standard' "
                    "WHERE btcpay_checkout_style IS NULL"
                )
            )
            connection.execute(
                text(
                    "UPDATE users SET default_confirmation_target = 10 "
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
        finally:
            if lock_acquired:
                connection.execute(
                    text("SELECT pg_advisory_unlock(:lock_id)"), {"lock_id": lock_id}
                )


app.include_router(router)
app.include_router(btcpay_router)
