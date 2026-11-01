"""Isolated browser backend: real HTTP/SQL, with external operations replaced."""
import os
from datetime import datetime, timezone
from unittest.mock import patch
import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from decimal import Decimal
from app.rates import QuoteResult
from sqlalchemy.engine import make_url
from app import payment_links, routes
from app.db import Base, engine, SessionLocal
from app.models import User, PaymentLink
from app.security import hash_api_key

assert make_url(str(engine.url)).database == "payment_link_tests"
Base.metadata.create_all(engine)
with SessionLocal() as db:
    if not db.query(PaymentLink).filter(PaymentLink.token == "fixture-token").first():
        user = User(payment_address="4" + "1" * 94, view_key_encrypted="fixture", api_key_hash=hash_api_key("fixture-only-api-key"), api_key_encrypted="fixture")
        db.add(user)
        db.flush()
        link = PaymentLink(user_id=user.id, token="fixture-token", title="Fixture product", description="Manual delivery", amount_xmr="0.1", confirmation_target=2, enabled=True)
        db.add(link)
        db.commit()

app = FastAPI()
paths = []
failures = set()
@app.middleware("http")
async def record(request: Request, call_next):
    paths.append(request.url.path)
    if request.url.path in failures:
        return JSONResponse({"detail": "Fixture unavailable"}, status_code=503)
    return await call_next(request)
@app.get("/api/core/__fixture/requests")
def request_paths():
    return paths
@app.get("/api/core/__fixture/failure")
def change_failure(mode: str = "none"):
    failures.clear()
    if mode == "allowance": failures.add("/api/core/payment-links/status")
    if mode == "invoices":
        from app.models import Invoice
        with SessionLocal() as db:
            for invoice in db.query(Invoice).all(): failures.add(f"/api/core/public/invoice/{invoice.id}")
    if mode == "addresses": failures.add("/api/core/subaddresses/status")
    return {"ok": True}
app.include_router(payment_links.router)
app.include_router(routes.router)

def address_status(*args):
    return {"retrieved_at": datetime.now(timezone.utc).isoformat(), "pool_size": 100, "cooldown_seconds": 604800,
            "counts": {"never_issued": 100, "eligible_for_reuse": 0, "reserved": 0, "cooling_down": 0, "needs_review": 0},
            "addresses": [], "snapshot": None, "earliest_estimated_eligibility_at": None}
with patch.object(routes, "get_xmr_rate", return_value=QuoteResult(Decimal("200"), "EUR", "fixture", datetime.now(timezone.utc))), patch.object(routes, "create_subaddress_for_user", return_value=("4" + "1" * 94, 1)), patch.object(routes, "ensure_invoice_qr_png"), patch.object(routes, "dispatch_webhooks"), patch.object(routes, "merchant_status", side_effect=address_status):
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="warning")
