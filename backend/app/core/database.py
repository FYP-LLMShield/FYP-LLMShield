from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import settings

class MongoDB:
    client: AsyncIOMotorClient = None
    database: AsyncIOMotorDatabase = None

mongodb = MongoDB()

async def connect_to_mongo():
    """Create database connection"""
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
    """Ping MongoDB to check connection status"""
    try:
        if mongodb.client is None or mongodb.database is None:
            return False
        await mongodb.client.admin.command("ping")
        return True
    except Exception as e:
        print(f"MongoDB ping failed: {str(e)}")
        return False