"""
Spatial Repository & Real-Time Dispatcher with MongoDB Persistence.
Maintains GeoJSON incident features in MongoDB with 2dsphere indexing,
supports automatic in-memory fallback, guarantees idempotency deduplication,
and streams updates via SSE pub-sub queues.
"""
import asyncio
import datetime
import logging
from typing import List, Set, Dict, Any, Optional
from .models import GeoJSONFeature, GeoJSONGeometry, IncidentProperties, GeoJSONFeatureCollection
from .config import SEED_SAMPLE_DATA
from .localization import get_localized_treatment
from .database import mongo_manager

logger = logging.getLogger("agroedge.geo_store")

class SpatialIncidentStore:
    def __init__(self):
        self.in_flight_ids: Set[str] = set()
        self.subscribers: List[asyncio.Queue] = []
        # In-memory buffer for zero-downtime fallback
        self.features: List[GeoJSONFeature] = []
        self.processed_ids: Set[str] = set()

    async def init_db(self):
        """
        Initializes MongoDB connection and seeds initial sample incidents.
        If MongoDB is connected and collection is empty, seeds into MongoDB.
        If MongoDB is unreachable, seeds into in-memory buffer.
        """
        connected = await mongo_manager.connect()
        if connected:
            collection = mongo_manager.get_collection()
            if collection is not None:
                try:
                    doc_count = await collection.count_documents({})
                    if doc_count == 0 and SEED_SAMPLE_DATA:
                        await self._seed_sample_incidents(to_mongo=True)
                except Exception as exc:
                    logger.warning(f"Error querying MongoDB on init: {exc}")
                    if SEED_SAMPLE_DATA and not self.features:
                        await self._seed_sample_incidents(to_mongo=False)
        else:
            if SEED_SAMPLE_DATA and not self.features:
                await self._seed_sample_incidents(to_mongo=False)

    async def close_db(self):
        """Closes the database client."""
        await mongo_manager.close()

    async def _seed_sample_incidents(self, to_mongo: bool = True):
        """
        Seeds initial realistic geographical incidents across agricultural zones.
        Ensures command dashboard is immediately populated with interactive clusters.
        """
        sample_data = [
            {
                "id": "init-inc-001",
                "lat": 30.7333, "lng": 76.7794,  # Punjab / Chandigarh
                "condition": "BacterialBlight",
                "category": "Bacteriology",
                "severity": "CRITICAL",
                "confidence": 0.96,
                "treatment": "Immediate Action: Spray Copper Oxychloride (2.5g/L). Drain standing water from the field.",
                "lang": "en"
            },
            {
                "id": "init-inc-002",
                "lat": 30.9010, "lng": 75.8573,  # Ludhiana
                "condition": "PestInfestation",
                "category": "Entomology",
                "severity": "HIGH",
                "confidence": 0.91,
                "treatment": "Immediate Action: Spray 5% Neem Seed Kernel Extract. Install pheromone traps.",
                "lang": "hi"
            },
            {
                "id": "init-inc-003",
                "lat": 18.5204, "lng": 73.8567,  # Pune, Maharashtra
                "condition": "EarlyBlightFungus",
                "category": "Mycology",
                "severity": "HIGH",
                "confidence": 0.88,
                "treatment": "Immediate Action: Apply Mancozeb 75% WP (2g/L). Prune infected lower foliage.",
                "lang": "en"
            },
            {
                "id": "init-inc-004",
                "lat": 19.9975, "lng": 73.7898,  # Nashik, Maharashtra
                "condition": "NutrientChlorosis",
                "category": "Agronomy",
                "severity": "MEDIUM",
                "confidence": 0.89,
                "treatment": "Foliar spray of Ferrous Sulphate 0.5% + Citric Acid 0.1%.",
                "lang": "hi"
            },
            {
                "id": "init-inc-005",
                "lat": 11.0168, "lng": 76.9558,  # Coimbatore, Tamil Nadu
                "condition": "PestInfestation",
                "category": "Entomology",
                "severity": "HIGH",
                "confidence": 0.94,
                "treatment": "உடனடி நடவடிக்கை: மாலை வேளையில் 5% வேப்பங்கொட்டை கரைசல் தெளிக்கவும்.",
                "lang": "ta"
            },
            {
                "id": "init-inc-006",
                "lat": 13.0827, "lng": 80.2707,  # Chennai periphery
                "condition": "HealthySample",
                "category": "Baseline",
                "severity": "LOW",
                "confidence": 0.99,
                "treatment": "பராமரிப்பு நடவடிக்கை: நோய் அறிகுறிகள் இல்லை. வழக்கமான நீர்ப்பாசனம் தொடரவும்.",
                "lang": "ta"
            },
            {
                "id": "init-inc-007",
                "lat": 17.3850, "lng": 78.4867,  # Hyderabad, Telangana
                "condition": "BacterialBlight",
                "category": "Bacteriology",
                "severity": "CRITICAL",
                "confidence": 0.93,
                "treatment": "తక్షణ చర్య: కాపర్ ఆక్సిక్లోరైడ్ మరియు స్ట్రెప్టోసైక్లిన్ కలిపి పిచికారీ చేయండి.",
                "lang": "te"
            },
            {
                "id": "init-inc-008",
                "lat": 22.5726, "lng": 88.3639,  # West Bengal
                "condition": "EarlyBlightFungus",
                "category": "Mycology",
                "severity": "HIGH",
                "confidence": 0.87,
                "treatment": "অবিলম্বে ব্যবস্থা: ম্যানকোজেব ৭৫% ডব্লিউপি স্প্রে করুন।",
                "lang": "bn"
            }
        ]

        now_str = datetime.datetime.now(datetime.timezone.utc).isoformat()
        docs = []
        for item in sample_data:
            loc = get_localized_treatment(item["condition"], item["lang"])
            feat = GeoJSONFeature(
                id=item["id"],
                geometry=GeoJSONGeometry(
                    type="Point",
                    coordinates=[item["lng"], item["lat"]]
                ),
                properties=IncidentProperties(
                    incident_id=item["id"],
                    condition=loc["title"],
                    category=item["category"],
                    confidence=item["confidence"],
                    severity=item["severity"],
                    treatment_plan=item["treatment"],
                    language=item["lang"],
                    timestamp=now_str,
                    reported_lat=item["lat"],
                    reported_lng=item["lng"],
                    agent_id="seed-historical"
                )
            )
            docs.append(feat.model_dump())
            self.features.append(feat)
            self.processed_ids.add(feat.id)

        if to_mongo and mongo_manager.is_connected:
            try:
                collection = mongo_manager.get_collection()
                if collection is not None and docs:
                    await collection.insert_many(docs)
                    logger.info(f"Pre-seeded {len(docs)} historical incidents into MongoDB.")
            except Exception as exc:
                logger.warning(f"Could not seed incidents into MongoDB: {exc}")

    async def is_duplicate(self, incident_id: str) -> bool:
        """Checks if an incident ID is currently in-flight or already stored."""
        if incident_id in self.in_flight_ids or incident_id in self.processed_ids:
            return True
        if mongo_manager.is_connected:
            collection = mongo_manager.get_collection()
            if collection is not None:
                try:
                    doc = await collection.find_one({"id": incident_id}, {"_id": 1})
                    return doc is not None
                except Exception:
                    pass
        return False

    def register_id(self, incident_id: str):
        """Registers an in-flight incident ID during initial payload validation."""
        self.in_flight_ids.add(incident_id)

    def remove_id(self, incident_id: str):
        """Discards an in-flight reservation upon error."""
        self.in_flight_ids.discard(incident_id)

    async def add_and_broadcast(self, feature: GeoJSONFeature):
        """
        Persists GeoJSON Feature to MongoDB (with upsert) and in-memory buffer,
        then broadcasts to all connected SSE clients.
        """
        feature_dict = feature.model_dump()
        self.in_flight_ids.discard(feature.id)
        self.processed_ids.add(feature.id)

        # Update in-memory buffer (newest first)
        existing_idx = next((i for i, f in enumerate(self.features) if f.id == feature.id), None)
        if existing_idx is not None:
            self.features[existing_idx] = feature
        else:
            self.features.insert(0, feature)

        # Persist to MongoDB if connected
        if mongo_manager.is_connected:
            collection = mongo_manager.get_collection()
            if collection is not None:
                try:
                    await collection.update_one(
                        {"id": feature.id},
                        {"$set": feature_dict},
                        upsert=True
                    )
                except Exception as exc:
                    logger.warning(f"MongoDB write failed for {feature.id}, held in memory: {exc}")

        # Broadcast to all connected command dashboard SSE subscribers
        stale_queues = []
        for q in list(self.subscribers):
            try:
                q.put_nowait(feature_dict)
            except asyncio.QueueFull:
                pass
            except Exception:
                stale_queues.append(q)

        for stale in stale_queues:
            if stale in self.subscribers:
                self.subscribers.remove(stale)

    async def get_feature_collection(self) -> GeoJSONFeatureCollection:
        """
        Retrieves all incidents from MongoDB or falls back to in-memory buffer.
        """
        if mongo_manager.is_connected:
            collection = mongo_manager.get_collection()
            if collection is not None:
                try:
                    cursor = collection.find({}, {"_id": 0}).sort("properties.timestamp", -1)
                    docs = await cursor.to_list(length=5000)
                    if docs:
                        features = [GeoJSONFeature(**d) for d in docs]
                        return GeoJSONFeatureCollection(features=features)
                except Exception as exc:
                    logger.warning(f"MongoDB read error: {exc}. Using in-memory store.")
        return GeoJSONFeatureCollection(features=self.features)

    async def get_incident_by_id(self, incident_id: str) -> Optional[GeoJSONFeature]:
        """Retrieves a single incident by ID from MongoDB or in-memory store."""
        if mongo_manager.is_connected:
            collection = mongo_manager.get_collection()
            if collection is not None:
                try:
                    doc = await collection.find_one({"id": incident_id}, {"_id": 0})
                    if doc:
                        return GeoJSONFeature(**doc)
                except Exception:
                    pass
        for feat in self.features:
            if feat.id == incident_id:
                return feat
        return None

    async def clear_all(self):
        """Purges all incidents from MongoDB and in-memory buffer."""
        self.features.clear()
        self.processed_ids.clear()
        self.in_flight_ids.clear()
        if mongo_manager.is_connected:
            collection = mongo_manager.get_collection()
            if collection is not None:
                try:
                    await collection.delete_many({})
                except Exception as exc:
                    logger.warning(f"Failed to clear MongoDB: {exc}")

    async def count_incidents(self) -> int:
        """Returns total count of incidents."""
        if mongo_manager.is_connected:
            collection = mongo_manager.get_collection()
            if collection is not None:
                try:
                    return await collection.count_documents({})
                except Exception:
                    pass
        return len(self.features)

    def subscribe(self) -> asyncio.Queue:
        q = asyncio.Queue(maxsize=100)
        self.subscribers.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue):
        if q in self.subscribers:
            self.subscribers.remove(q)

geo_store = SpatialIncidentStore()
