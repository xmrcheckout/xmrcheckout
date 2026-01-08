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
