"""Configured public origin; request headers never select checkout destinations."""
import os


def public_origin(request):
    return os.getenv("SITE_URL", "http://localhost:3000").rstrip("/")
