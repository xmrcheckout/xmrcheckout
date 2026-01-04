import hashlib
import secrets

from fastapi import Depends, Header, HTTPException, status
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from .config import (
    API_KEYS,
    API_KEY_ENCRYPTION_KEY,
)
from .db import get_db
from .models import User

_pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def _parse_authorization_api_key(authorization: str | None) -> str | None:
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() not in ("apikey", "token"):
        return None
    token = token.strip()
    return token or None


def require_api_key(
    authorization: str | None = Header(default=None),
    x_api_key: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> str:
    api_key = _parse_authorization_api_key(authorization) or x_api_key
    if api_key is None or api_key not in API_KEYS:
        if api_key is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid API key",
            )
        api_key_hash = hash_api_key(api_key)
        user = db.query(User).filter(User.api_key_hash == api_key_hash).first()
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid API key",
            )
    return api_key


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _pwd_context.verify(password, password_hash)


def generate_api_key() -> str:
    return f"xmrcheckout_{secrets.token_urlsafe(32)}"


def generate_webhook_secret() -> str:
    return f"whsec_{secrets.token_urlsafe(32)}"


def hash_api_key(api_key: str) -> str:
    return hashlib.sha256(api_key.encode("utf-8")).hexdigest()


def encrypt_api_key(api_key: str) -> str:
    return encrypt_secret(api_key)


def decrypt_api_key(api_key_encrypted: str) -> str:
    return decrypt_secret(api_key_encrypted)


def encrypt_secret(value: str) -> str:
    from cryptography.fernet import Fernet

    return Fernet(API_KEY_ENCRYPTION_KEY).encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_secret(value_encrypted: str) -> str:
    from cryptography.fernet import Fernet

    return Fernet(API_KEY_ENCRYPTION_KEY).decrypt(
        value_encrypted.encode("utf-8")
    ).decode("utf-8")
