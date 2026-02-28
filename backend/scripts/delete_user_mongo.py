"""
One-off script: delete a user from MongoDB (users collection).
Uses backend .env for MONGODB_URL and DATABASE_NAME.

Usage:
  From backend folder:  python scripts/delete_user_mongo.py <email>
  Example:             python scripts/delete_user_mongo.py user@example.com
"""
import asyncio
import sys
from pathlib import Path

# Add backend to path so app.core is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.database import connect_to_mongo, close_mongo_connection, mongodb
from app.core.config import settings


async def delete_user_by_email(email: str) -> bool:
    await connect_to_mongo()
    try:
        coll = mongodb.database["users"]
        result = await coll.delete_one({"email": email})
        if result.deleted_count:
            print(f"Deleted user: {email}")
            return True
        print(f"No user found with email: {email}")
        return False
    finally:
        await close_mongo_connection()


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/delete_user_mongo.py <email>")
        print("Example: python scripts/delete_user_mongo.py user@example.com")
        sys.exit(1)
    email = sys.argv[1].strip()
    if not email:
        print("Error: provide a non-empty email")
        sys.exit(1)
    ok = asyncio.run(delete_user_by_email(email))
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
