from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import settings

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
    print(f"Connected to MongoDB at {settings.MONGODB_URL}")

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