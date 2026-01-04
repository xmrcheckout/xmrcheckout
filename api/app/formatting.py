from decimal import Decimal


def format_xmr_amount(value: Decimal) -> str:
    normalized = value.normalize()
    formatted = format(normalized, "f")
    if "." in formatted:
        formatted = formatted.rstrip("0").rstrip(".")
    return formatted or "0"
