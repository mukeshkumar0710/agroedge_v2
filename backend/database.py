"""
MongoDB Async Database Manager using Motor.
Provides strict connection lifecycle, 2dsphere indexing for geospatial telemetry,
and high-availability fallback to in-memory store if MongoDB is temporarily unreachable.
"""
import logging
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase, AsyncIOMotorCollection
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError

from .config import (
    MONGODB_URI,
    MONGODB_DB_NAME,
    MONGODB_COLLECTION_NAME,
    MONGODB_CONNECT_TIMEOUT_MS
)

logger = logging.getLogger("agroedge.database")

class MongoManager:
    def __init__(self):
        self.client: Optional[AsyncIOMotorClient] = None
        self.db: Optional[AsyncIOMotorDatabase] = None
        self.collection: Optional[AsyncIOMotorCollection] = None
        self.is_connected: bool = False

    async def connect(self) -> bool:
        """
        Connects to MongoDB with short timeout.
        If connected, creates geospatial and unique idempotency indexes.
        If MongoDB is unavailable, gracefully logs a warning and returns False without crashing,
        enabling the application to use the high-availability in-memory buffer.
        """
        logger.info(f"Connecting to MongoDB at '{MONGODB_URI}' (DB: '{MONGODB_DB_NAME}')...")
        try:
            self.client = AsyncIOMotorClient(
                MONGODB_URI,
                serverSelectionTimeoutMS=MONGODB_CONNECT_TIMEOUT_MS,
                connectTimeoutMS=MONGODB_CONNECT_TIMEOUT_MS
            )
            # Perform ping check
            await self.client.admin.command("ping")
            self.db = self.client[MONGODB_DB_NAME]
            self.collection = self.db[MONGODB_COLLECTION_NAME]

            # Ensure indexes
            # 1. 2dsphere index on GeoJSON geometry for fast geospatial queries
            await self.collection.create_index([("geometry", "2dsphere")], name="idx_geometry_2dsphere")
            # 2. Unique index on incident id for strict idempotency deduplication
            await self.collection.create_index([("id", 1)], unique=True, name="idx_incident_id_unique")
            # 3. Descending index on timestamp for efficient sorting and dashboard retrieval
            await self.collection.create_index([("properties.timestamp", -1)], name="idx_timestamp_desc")

            self.is_connected = True
            logger.info("MongoDB Atlas connection established and 2dsphere spatial indexes verified.")
            return True

        except (ConnectionFailure, ServerSelectionTimeoutError, Exception) as exc:
            self.is_connected = False
            if self.client:
                self.client.close()
                self.client = None
            self.db = None
            self.collection = None
            logger.warning(
                f"[Notice] Could not connect to MongoDB at '{MONGODB_URI}' ({exc}). "
                f"Activating high-availability in-memory fallback buffer. "
                f"The portal will remain 100% operational."
            )
            return False

    async def close(self):
        """Closes the MongoDB connection."""
        if self.client:
            self.client.close()
            self.client = None
            self.db = None
            self.collection = None
            self.is_connected = False
            logger.info("MongoDB client closed.")

    async def ping(self) -> bool:
        """Verifies active connection liveness."""
        if not self.is_connected or not self.client:
            return False
        try:
            await self.client.admin.command("ping")
            return True
        except Exception:
            self.is_connected = False
            return False

    def get_collection(self) -> Optional[AsyncIOMotorCollection]:
        return self.collection if self.is_connected else None

mongo_manager = MongoManager()
