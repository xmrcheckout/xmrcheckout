from fastapi import HTTPException
from monero.address import Address


class MainnetWalletRequired(HTTPException):
    def __init__(self, status_code: int):
        super().__init__(
            status_code=status_code,
            detail="A Monero Mainnet primary address is required.",
            headers={"X-Checkout-Error": "mainnet_wallet_required"},
        )


def require_mainnet_wallet(payment_address: str, *, status_code: int = 400) -> None:
    try:
        network = Address(payment_address).net
    except ValueError:
        raise MainnetWalletRequired(status_code) from None
    if network != "main":
        raise MainnetWalletRequired(status_code)
