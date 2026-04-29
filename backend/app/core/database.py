import logging
from urllib.parse import urlparse

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import settings

_log = logging.getLogger(__name__)


def _mongo_log_label(url: str) -> str:
    """Host + db name for logs (no password)."""
    if not url:
        return "(empty)"
    try:
        p = urlparse(url)
        host = p.hostname or p.netloc.split("@")[-1].split("/")[0] if p.netloc else "(unknown)"
        return f"{p.scheme}://{host}"
    except Exception:
        return "(unparseable URL)"


class MongoDB:
    client: AsyncIOMotorClient = None
    database: AsyncIOMotorDatabase = None

mongodb = MongoDB()

async def connect_to_mongo():
    """Create database connection. Use certifi CA bundle for remote MongoDB Atlas connections."""
    try:
        import certifi
        # Only add TLS CA bundle for remote MongoDB (Atlas), not for localhost
        if "localhost" in settings.MONGODB_URL or "127.0.0.1" in settings.MONGODB_URL:
            # Local MongoDB - no TLS needed
            mongodb.client = AsyncIOMotorClient(settings.MONGODB_URL)
        else:
            # Remote MongoDB Atlas - use TLS with CA bundle
            mongodb.client = AsyncIOMotorClient(
                settings.MONGODB_URL,
                tlsCAFile=certifi.where(),
            )
    except ImportError:
        mongodb.client = AsyncIOMotorClient(settings.MONGODB_URL)
    mongodb.database = mongodb.client[settings.DATABASE_NAME]
    _log.info(
        "Connected to MongoDB: %s (database=%s). Set MONGODB_URL in backend/.env to use Atlas.",
        _mongo_log_label(settings.MONGODB_URL),
        settings.DATABASE_NAME,
    )
    await _ensure_indexes(mongodb.database)


async def _ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    """Create indexes for the scan_history collection (idempotent — safe to run on every start)."""
    try:
        from pymongo import ASCENDING, DESCENDING
        coll = db.scan_history
        await coll.create_index(
            [("user_id", ASCENDING), ("timestamp", DESCENDING)],
            name="user_timestamp",
            background=True,
        )
        await coll.create_index(
            [("user_id", ASCENDING), ("scan_type", ASCENDING)],
            name="user_scan_type",
            background=True,
        )
        await coll.create_index(
            [("user_id", ASCENDING), ("status", ASCENDING)],
            name="user_status",
            background=True,
        )
        _log.info("scan_history indexes ensured.")
    except Exception as exc:
        _log.warning("Could not create scan_history indexes: %s", exc)

async def close_mongo_connection():
    """Close database connection"""
    mongodb.client.close()
    print("Disconnected from MongoDB")

async def get_database() -> AsyncIOMotorDatabase:
    """Get database instance"""
    return mongodb.database


async def ping_mongo() -> bool:
    """Ping MongoDB to verify connectivity. Used for readiness probes."""
    try:
        if mongodb.client is None:
            return False
        await mongodb.client.admin.command("ping")
        return True
    except Exception:
        return False