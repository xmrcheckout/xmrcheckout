from datetime import datetime
from decimal import Decimal
from typing import Any, Literal
from uuid import UUID

from pydantic import (
    AnyUrl,
    BaseModel,
    ConfigDict,
    Field,
    conint,
    field_serializer,
    field_validator,
    model_validator,
)

from .formatting import format_xmr_amount

InvoiceStatus = Literal["pending", "payment_detected", "confirmed", "expired", "invalid"]
BtcpayCheckoutStyle = Literal["standard", "btcpay_classic"]
QrLogoMode = Literal["monero", "none", "custom"]


class InvoiceCreate(BaseModel):
    amount_xmr: Decimal | None = Field(default=None, gt=0)
    amount_fiat: Decimal | None = Field(default=None, gt=0)
    currency: str | None = None
    confirmation_target: conint(ge=0, le=10) = 1
    checkout_continue_url: AnyUrl | None = Field(
        default=None,
        description="Optional: after the invoice is confirmed, the hosted invoice page can offer a Continue button that navigates to this merchant URL.",
    )
    metadata: dict[str, Any] | None = None
    expires_at: datetime | None = Field(
        default=None,
        description="Defaults to 60 minutes from creation if omitted.",
    )

    @field_validator("currency")
    @classmethod
    def _normalize_currency(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip().upper()

    @model_validator(mode="after")
    def _validate_amounts(self) -> "InvoiceCreate":
        if self.amount_xmr is None and self.amount_fiat is None:
            raise ValueError("amount_xmr or amount_fiat is required")
        if self.amount_xmr is not None and self.amount_fiat is not None:
            raise ValueError("Provide either amount_xmr or amount_fiat, not both")
        if self.amount_fiat is not None and not self.currency:
            raise ValueError("currency is required when amount_fiat is provided")
        return self

    @field_validator("checkout_continue_url")
    @classmethod
    def _validate_checkout_continue_url(cls, value: AnyUrl | None) -> AnyUrl | None:
        if value is None:
            return None
        if value.scheme == "https":
            return value
        if value.scheme == "http" and value.host in ("localhost", "127.0.0.1"):
            return value
        raise ValueError("checkout_continue_url must use https (http is allowed for localhost)")


class DonationCreate(BaseModel):
    amount_xmr: Decimal = Field(gt=0)
    confirmation_target: conint(ge=0, le=10) = 1


class InvoiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    address: str
    subaddress_index: int | None = None
    amount_xmr: Decimal
    status: InvoiceStatus
    confirmation_target: int
    confirmations: int = 0
    paid_after_expiry: bool = False
    paid_after_expiry_at: datetime | None = None
    qr_logo: QrLogoMode | None = None
    qr_logo_data_url: str | None = None
    metadata: dict[str, Any] | None = Field(default=None, validation_alias="metadata_json")
    warnings: list[str] | None = None
    quote: dict[str, Any] | None = None
    invoice_url: str | None = None
    qr_url: str | None = None
    created_at: datetime
    archived_at: datetime | None = None
    expires_at: datetime | None
    detected_at: datetime | None
    confirmed_at: datetime | None

    @field_serializer("amount_xmr")
    def _serialize_amount_xmr(self, value: Decimal) -> str:
        return format_xmr_amount(value)


class InvoiceCreateUser(BaseModel):
    amount_xmr: Decimal | None = Field(default=None, gt=0)
    amount_fiat: Decimal | None = Field(default=None, gt=0)
    currency: str | None = None
    confirmation_target: conint(ge=0, le=10) = 1
    checkout_continue_url: AnyUrl | None = Field(
        default=None,
        description="Optional: after the invoice is confirmed, the hosted invoice page can offer a Continue button that navigates to this merchant URL.",
    )
    metadata: dict[str, Any] | None = None
    expires_at: datetime | None = Field(
        default=None,
        description="Defaults to 60 minutes from creation if omitted.",
    )

    @field_validator("currency")
    @classmethod
    def _normalize_currency(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip().upper()

    @model_validator(mode="after")
    def _validate_amounts(self) -> "InvoiceCreateUser":
        if self.amount_xmr is None and self.amount_fiat is None:
            raise ValueError("amount_xmr or amount_fiat is required")
        if self.amount_xmr is not None and self.amount_fiat is not None:
            raise ValueError("Provide either amount_xmr or amount_fiat, not both")
        if self.amount_fiat is not None and not self.currency:
            raise ValueError("currency is required when amount_fiat is provided")
        return self

    @field_validator("checkout_continue_url")
    @classmethod
    def _validate_checkout_continue_url(cls, value: AnyUrl | None) -> AnyUrl | None:
        if value is None:
            return None
        if value.scheme == "https":
            return value
        if value.scheme == "http" and value.host in ("localhost", "127.0.0.1"):
            return value
        raise ValueError("checkout_continue_url must use https (http is allowed for localhost)")


class InvoiceListResponse(BaseModel):
    items: list[InvoiceResponse]
    total: int


class InvoiceStatusResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    address: str
    subaddress_index: int | None = None
    amount_xmr: Decimal
    amount_paid_xmr: str | None = None
    status: InvoiceStatus
    confirmation_target: int
    confirmations: int = 0
    paid_after_expiry: bool = False
    paid_after_expiry_at: datetime | None = None
    qr_logo: QrLogoMode | None = None
    qr_logo_data_url: str | None = None
    created_at: datetime
    expires_at: datetime | None
    detected_at: datetime | None
    confirmed_at: datetime | None
    btcpay_amount: str | None = None
    btcpay_currency: str | None = None
    btcpay_checkout_style: BtcpayCheckoutStyle | None = None
    btcpay_redirect_url: str | None = None
    btcpay_redirect_automatically: bool | None = None
    btcpay_order_id: str | None = None
    btcpay_order_number: str | None = None
    checkout_continue_available: bool = False
    quote: dict[str, Any] | None = None
    qr_url: str | None = None

    @field_serializer("amount_xmr")
    def _serialize_amount_xmr(self, value: Decimal) -> str:
        return format_xmr_amount(value)


class ProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    payment_address: str
    default_confirmation_target: conint(ge=0, le=10) = 1
    default_qr_logo: QrLogoMode = "monero"
    default_qr_logo_data_url: str | None = None
    btcpay_checkout_style: BtcpayCheckoutStyle = "btcpay_classic"
    created_at: datetime


class ProfileUpdate(BaseModel):
    btcpay_checkout_style: BtcpayCheckoutStyle | None = None
    default_confirmation_target: conint(ge=0, le=10) | None = None
    default_qr_logo: QrLogoMode | None = None
    default_qr_logo_data_url: str | None = None


class WebhookCreate(BaseModel):
    url: AnyUrl | None = None
    events: list[
        Literal[
            "invoice.created",
            "invoice.payment_detected",
            "invoice.confirmed",
            "invoice.expired",
        ]
    ] | None = None
    event_urls: dict[
        Literal[
            "invoice.created",
            "invoice.payment_detected",
            "invoice.confirmed",
            "invoice.expired",
        ],
        AnyUrl,
    ] | None = None


class WebhookResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    url: AnyUrl | None = None
    events: list[str]
    event_urls: dict[str, AnyUrl] | None = None
    active: bool
    created_at: datetime


class WebhookDeliveryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    webhook_id: UUID | None = None
    event: str
    url: str
    invoice_id: UUID | None = None
    invoice_address: str | None = None
    invoice_subaddress_index: int | None = None
    invoice_amount_xmr: Decimal | None = None
    invoice_status: InvoiceStatus | None = None
    http_status: int | None = None
    error_message: str | None = None
    created_at: datetime

    @field_serializer("invoice_amount_xmr")
    def _serialize_invoice_amount_xmr(self, value: Decimal | None) -> str | None:
        if value is None:
            return None
        return format_xmr_amount(value)


class LoginRequest(BaseModel):
    payment_address: str = Field(min_length=1)
    view_key: str = Field(min_length=1, max_length=256)


class LoginResponse(BaseModel):
    api_key: str
    webhook_secret: str
    store_id: UUID


class ApiCredentialsResetRequest(BaseModel):
    reset_api_key: bool = False
    reset_webhook_secret: bool = False


class ApiCredentialsResetResponse(BaseModel):
    api_key: str | None = None
    webhook_secret: str | None = None
