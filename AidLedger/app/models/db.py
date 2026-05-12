"""
Prisma Python Client — Singleton Database Connection.

Uses Prisma's sync interface which is perfect for Flask's synchronous
request-handling model. The client is connected once at startup and
stays alive for the entire app lifetime.
"""
import logging
from prisma import Prisma

logger = logging.getLogger(__name__)

# ── Singleton Instance ────────────────────────────────────────────────────────
# One connection pool shared across all requests.
_db: Prisma | None = None


def get_db() -> Prisma:
    """Returns the connected Prisma singleton. Raises if not initialized."""
    if _db is None or not _db.is_connected():
        raise RuntimeError(
            "Database not connected. Call connect_db() during app startup."
        )
    return _db


def connect_db() -> None:
    """
    Establishes the Prisma database connection.
    Must be called once during Flask app startup inside the app context.
    """
    global _db
    _db = Prisma()
    _db.connect()
    logger.info("✅ Successfully connected to PostgreSQL database (Prisma).")


def disconnect_db() -> None:
    """Gracefully closes the Prisma database connection."""
    global _db
    if _db and _db.is_connected():
        _db.disconnect()
        logger.info("🔒 Database connection closed.")
