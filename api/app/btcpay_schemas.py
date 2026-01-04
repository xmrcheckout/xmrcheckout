from __future__ import annotations

from decimal import Decimal
from typing import Any

from pydantic import (
    AnyUrl,
    BaseModel,
    Field,
    conint,
    field_validator,
    model_validator,
)


class BtcpayCheckout(BaseModel):
    redirectURL: AnyUrl | None = None
    speedPolicy: str | None = None
    paymentMethods: list[str] | None = None
    expirationMinutes: conint(ge=1, le=10080) | None = None
    monitoringMinutes: conint(ge=0, le=10080) | None = None
    paymentTolerance: Decimal | None = None
    redirectAutomatically: bool | None = None
    defaultLanguage: str | None = None


class BtcpayInvoiceCreate(BaseModel):
    amount: Decimal = Field(gt=0)
    currency: str = Field(min_length=1)
    metadata: dict[str, Any] | None = None
    checkout: BtcpayCheckout | None = None

    @field_validator("currency")
    @classmethod
    def _normalize_currency(cls, value: str) -> str:
        return value.strip().upper()


class BtcpayWebhookEvents(BaseModel):
    everything: bool = False
    specificEvents: list[str] | None = None

    @model_validator(mode="after")
    def _validate_selection(self) -> "BtcpayWebhookEvents":
        if not self.everything and not self.specificEvents:
            raise ValueError("Select at least one event")
        return self


class BtcpayWebhookCreate(BaseModel):
    enabled: bool = True
    automaticRedelivery: bool = True
    url: AnyUrl
    authorizedEvents: BtcpayWebhookEvents


class BtcpayWebhookUpdate(BaseModel):
    enabled: bool | None = None
    automaticRedelivery: bool | None = None
    url: AnyUrl | None = None
    authorizedEvents: BtcpayWebhookEvents | None = None


class BtcpayInvoiceStatusUpdate(BaseModel):
    status: str = Field(min_length=1)
