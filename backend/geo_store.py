"""
Spatial Repository & Real-Time Dispatcher.
Maintains GeoJSON incident features, idempotency cache, and pub-sub queues.
"""
import asyncio
import datetime
from typing import List, Set, Dict, Any
from .models import GeoJSONFeature, GeoJSONGeometry, IncidentProperties, GeoJSONFeatureCollection
from .config import SEED_SAMPLE_DATA
from .localization import get_localized_treatment

class SpatialIncidentStore:
    def __init__(self):
        self.processed_ids: Set[str] = set()
        self.features: List[GeoJSONFeature] = []
        self.subscribers: List[asyncio.Queue] = []
        if SEED_SAMPLE_DATA:
            self._seed_sample_incidents()


    def clear_all(self):
        """Purges all incidents and deduplication IDs."""
        self.features.clear()
        self.processed_ids.clear()

    def _seed_sample_incidents(self):

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
        for item in sample_data:
            self.processed_ids.add(item["id"])
            loc = get_localized_treatment(item["condition"], item["lang"])
            feat = GeoJSONFeature(
                id=item["id"],
                geometry=GeoJSONGeometry(
                    type="Point",
                    # RFC 7946: [lng, lat]
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
            self.features.append(feat)


    def is_duplicate(self, incident_id: str) -> bool:
        return incident_id in self.processed_ids

    def register_id(self, incident_id: str):
        self.processed_ids.add(incident_id)

    def remove_id(self, incident_id: str):
        self.processed_ids.discard(incident_id)

    async def add_and_broadcast(self, feature: GeoJSONFeature):
        self.features.insert(0, feature)
        self.processed_ids.add(feature.id)

        # Broadcast to all connected command dashboard SSE subscribers
        feature_dict = feature.model_dump()
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

    def get_feature_collection(self) -> GeoJSONFeatureCollection:
        return GeoJSONFeatureCollection(features=self.features)

    def get_incident_by_id(self, incident_id: str):
        for feat in self.features:
            if feat.id == incident_id:
                return feat
        return None


    def subscribe(self) -> asyncio.Queue:
        q = asyncio.Queue(maxsize=100)
        self.subscribers.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue):
        if q in self.subscribers:
            self.subscribers.remove(q)

geo_store = SpatialIncidentStore()
