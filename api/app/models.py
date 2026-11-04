import uuid

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.sql import func
from sqlalchemy.types import JSON

from .db import Base


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    payment_link_id = Column(UUID(as_uuid=True), nullable=True)
    payment_link_attempt_id = Column(UUID(as_uuid=True), nullable=True)
    terminal_id = Column(UUID(as_uuid=True), nullable=True)
    terminal_attempt_id = Column(UUID(as_uuid=True), nullable=True)
    __table_args__ = (UniqueConstraint("payment_link_id", "payment_link_attempt_id", name="invoice_payment_link_attempt"),)
    wallet_address = Column(String, nullable=True, index=True)
    address = Column(String, nullable=False)
    subaddress_index = Column(Integer, nullable=True)
    amount_xmr = Column(Numeric(18, 12), nullable=False)
    status = Column(String, nullable=False, index=True)
    confirmation_target = Column(Integer, nullable=False)
    confirmations = Column(Integer, nullable=False, server_default="0")
    total_paid_atomic = Column(BigInteger, nullable=True)
    paid_after_expiry = Column(Boolean, nullable=False, server_default="false")
    paid_after_expiry_at = Column(DateTime(timezone=True), nullable=True)
    metadata_json = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    archived_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    detected_at = Column(DateTime(timezone=True), nullable=True)
    confirmed_at = Column(DateTime(timezone=True), nullable=True)


class InvoiceTransfer(Base):
    __tablename__ = "invoice_transfers"
    __table_args__ = (
        UniqueConstraint(
            "invoice_id",
            "txid",
            name="uq_invoice_transfers_invoice_txid",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    txid = Column(String, nullable=False)
    amount_atomic = Column(BigInteger, nullable=False)
    confirmations = Column(Integer, nullable=False, server_default="0")
    timestamp = Column(BigInteger, nullable=True)
    address = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class Webhook(Base):
    __tablename__ = "webhooks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    url = Column(String, nullable=True)
    events = Column(ARRAY(String), nullable=False)
    event_urls = Column(JSON, nullable=True)
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class BtcpayWebhook(Base):
    __tablename__ = "btcpay_webhooks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    url = Column(String, nullable=False)
    enabled = Column(Boolean, nullable=False, default=True)
    automatic_redelivery = Column(Boolean, nullable=False, default=True)
    authorized_events = Column(JSON, nullable=False)
    secret_encrypted = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class WebhookDelivery(Base):
    __tablename__ = "webhook_deliveries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    webhook_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    event = Column(String, nullable=False)
    url = Column(String, nullable=False)
    invoice_id = Column(UUID(as_uuid=True), nullable=True)
    invoice_address = Column(String, nullable=True)
    invoice_subaddress_index = Column(Integer, nullable=True)
    invoice_amount_xmr = Column(Numeric(18, 12), nullable=True)
    invoice_status = Column(String, nullable=True)
    payload_json = Column("payload", JSON, nullable=True)
    http_status = Column(Integer, nullable=True)
    error_message = Column(String, nullable=True)
    # "native" deliveries reference webhooks.id; "btcpay" ones btcpay_webhooks.id.
    kind = Column(String, nullable=False, default="native", server_default="native")
    attempt = Column(Integer, nullable=False, default=1, server_default="1")
    # Set only while an automatic retry of this failed attempt is pending.
    next_attempt_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    payment_address = Column(String, nullable=False, unique=True, index=True)
    view_key_encrypted = Column(String, nullable=False)
    api_key_hash = Column(String, nullable=False, unique=True, index=True)
    api_key_encrypted = Column(String, nullable=False)
    webhook_secret_encrypted = Column(String, nullable=True)
    next_subaddress_index = Column(Integer, nullable=False, server_default="1")
    subaddress_start_index = Column(Integer, nullable=False, server_default="0")
    default_confirmation_target = Column(Integer, nullable=False, server_default="1")
    default_qr_logo = Column(String, nullable=False, server_default="monero")
    default_qr_logo_data_url = Column(String, nullable=True)
    btcpay_checkout_style = Column(String, nullable=False, server_default="btcpay_classic")
    invoice_creation_window_started_at = Column(DateTime(timezone=True), nullable=True)
    invoice_creation_count = Column(Integer, nullable=False, server_default="0")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ProfileHistory(Base):
    __tablename__ = "profile_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    field_name = Column(String, nullable=False)
    old_value = Column(String, nullable=True)
    new_value = Column(String, nullable=True)
    value_encrypted = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class SystemStatus(Base):
    __tablename__ = "system_status"

    name = Column(String, primary_key=True)
    last_reconcile_started_at = Column(DateTime(timezone=True), nullable=True)
    last_reconcile_completed_at = Column(DateTime(timezone=True), nullable=True)
    last_reconcile_error = Column(String, nullable=True)
    last_reconcile_attempted_invoices = Column(Integer, nullable=False, server_default="0")
    last_reconcile_succeeded_invoices = Column(Integer, nullable=False, server_default="0")
    last_reconcile_failed_invoices = Column(Integer, nullable=False, server_default="0")
    wallet_rpc = Column(String, nullable=True)
    daemon = Column(String, nullable=True)
    daemon_height = Column(Integer, nullable=True)
    checked_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class SnapshotStatus(Base):
    __tablename__ = "snapshot_status"

    # No user foreign key: diagnostics must commit while allocation holds the user lock.
    user_id = Column(UUID(as_uuid=True), primary_key=True)
    attempt_id = Column(UUID(as_uuid=True), nullable=False)
    attempted_at = Column(DateTime(timezone=True), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    outcome = Column(String, nullable=False)
    duration_ms = Column(Integer, nullable=True)
    failure_category = Column(String, nullable=True)
    last_success_at = Column(DateTime(timezone=True), nullable=True)


class SubaddressAllocation(Base):
    __tablename__ = "subaddress_allocations"
    __table_args__ = (
        UniqueConstraint("user_id", "address", "generation", name="uq_subaddress_generation"),
    )

    invoice_id = Column(UUID(as_uuid=True), primary_key=True)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    address = Column(String, nullable=False, index=True)
    subaddress_index = Column(Integer, nullable=False)
    generation = Column(Integer, nullable=False)
    cutoff_height = Column(BigInteger, nullable=True)
    excluded_txids = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class PaymentLink(Base):
    __tablename__ = "payment_links"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    token = Column(String(64), nullable=False, unique=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(String(2000), nullable=False, default="")
    amount_xmr = Column(Numeric(18, 12), nullable=True)
    amount_fiat = Column(Numeric(18, 2), nullable=True)
    currency = Column(String(3), nullable=True)
    confirmation_target = Column(Integer, nullable=False)
    checkout_continue_url = Column(String, nullable=True)
    confirmation_message = Column(String(2000), nullable=True)
    enabled = Column(Boolean, nullable=False, default=True)
    auto_create_invoice = Column(Boolean, nullable=False, default=False, server_default="false")
    button_text = Column(String(32), nullable=False, default="Buy with Monero", server_default="Buy with Monero")
    customer_amount = Column(Boolean, nullable=False, default=False, server_default="false")
    minimum_amount_xmr = Column(Numeric(18, 12), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Terminal(Base):
    """In-person checkout screen. Its secret can only create and read its own invoices."""
    __tablename__ = "terminals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    token_hash = Column(String(64), nullable=False, unique=True, index=True)
    default_currency = Column(String(3), nullable=False, default="XMR", server_default="XMR")
    confirmation_target = Column(Integer, nullable=False, default=0, server_default="0")
    expiry_minutes = Column(Integer, nullable=False, default=15, server_default="15")
    enabled = Column(Boolean, nullable=False, default=True, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_used_at = Column(DateTime(timezone=True), nullable=True)
