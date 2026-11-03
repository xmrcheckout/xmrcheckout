from decimal import ROUND_DOWN, Decimal


def format_xmr_amount(value: Decimal) -> str:
    normalized = value.normalize()
    formatted = format(normalized, "f")
    if "." in formatted:
        formatted = formatted.rstrip("0").rstrip(".")
    return formatted or "0"


def atomic_to_xmr(amount_atomic: int) -> Decimal:
    return Decimal(amount_atomic) / (Decimal(10) ** 12)


ATOMIC_UNITS_PER_XMR = Decimal("1000000000000")


def xmr_to_atomic(amount: Decimal) -> int:
    return int(
        (Decimal(amount) * ATOMIC_UNITS_PER_XMR).to_integral_value(rounding=ROUND_DOWN)
    )


def invoice_paid_atomic(invoice) -> int:
    return max(0, int(getattr(invoice, "total_paid_atomic", None) or 0))


def invoice_remaining_atomic(invoice) -> int:
    return max(0, xmr_to_atomic(invoice.amount_xmr) - invoice_paid_atomic(invoice))


def invoice_amounts(invoice) -> tuple[str, str]:
    """Return (amount_paid_xmr, amount_remaining_xmr) as display strings."""
    paid = invoice_paid_atomic(invoice)
    remaining = invoice_remaining_atomic(invoice)
    return (
        format_xmr_amount(atomic_to_xmr(paid)),
        format_xmr_amount(atomic_to_xmr(remaining)),
    )


def is_partially_paid(invoice) -> bool:
    paid = invoice_paid_atomic(invoice)
    return 0 < paid < xmr_to_atomic(invoice.amount_xmr)


def is_overpaid(invoice) -> bool:
    return invoice_paid_atomic(invoice) > xmr_to_atomic(invoice.amount_xmr)
