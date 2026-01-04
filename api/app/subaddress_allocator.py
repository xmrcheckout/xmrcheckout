from __future__ import annotations

from sqlalchemy.orm import Session

from .models import User
from .security import decrypt_secret
from .subaddress_derivation import derive_subaddress


MAX_SUBADDRESS_INDEX = 100


def create_subaddress_for_user(
    db: Session,
    *,
    user: User,
) -> tuple[str, int | None]:
    locked = (
        db.query(User)
        .filter(
            User.id == user.id,
        )
        .with_for_update()
        .first()
    )
    if locked is None:
        raise ValueError("User not found")
    start_index = int(locked.subaddress_start_index or 0)
    if start_index < 0 or start_index >= MAX_SUBADDRESS_INDEX:
        start_index = 0
    range_start = start_index + 1
    range_end = MAX_SUBADDRESS_INDEX
    next_index = int(locked.next_subaddress_index or range_start)
    if next_index < range_start or next_index > range_end:
        next_index = range_start
    next_next_index = next_index + 1
    if next_next_index > range_end:
        next_next_index = range_start
    locked.next_subaddress_index = next_next_index
    db.flush()
    view_key = decrypt_secret(locked.view_key_encrypted)
    address = derive_subaddress(
        payment_address=locked.payment_address,
        view_key=view_key,
        account_index=0,
        address_index=next_index,
    )
    return address, int(next_index)
