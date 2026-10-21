"""
Asynchronous Machine Learning Inference Pipeline.
Provides image inspection, simulated ONNX/PyTorch model classification,
feature extraction, and confidence/severity scoring.
"""
import io
import asyncio
import random
from typing import Dict, Any
from PIL import Image

CONDITIONS_CATALOG = [
    {"condition": "PestInfestation", "category": "Entomology", "severity": "HIGH"},
    {"condition": "BacterialBlight", "category": "Bacteriology", "severity": "CRITICAL"},
    {"condition": "EarlyBlightFungus", "category": "Mycology", "severity": "HIGH"},
    {"condition": "NutrientChlorosis", "category": "Agronomy", "severity": "MEDIUM"},
    {"condition": "HealthySample", "category": "Baseline", "severity": "LOW"}
]

class AsyncMLClassifier:
    def __init__(self):
        self.model_loaded = True
        self.model_version = "v2.4-vit-agro-edge"

    async def predict_image(self, image_bytes: bytes) -> Dict[str, Any]:
        """
        Asynchronously inspects image payload and generates classification.
        Non-blocking execution using asyncio.to_thread for CPU-intensive image ops.
        """
        # Run CPU image parsing off the main event loop
        metadata = await asyncio.to_thread(self._analyze_image_features, image_bytes)

        # Non-blocking simulated neural network inference delay
        await asyncio.sleep(0.18)

        # Deterministic heuristic: classify based on image channel dominance or seeded random
        detected_idx = metadata.get("heuristic_index", 0) % len(CONDITIONS_CATALOG)
        detected = CONDITIONS_CATALOG[detected_idx]

        confidence = round(0.85 + (random.random() * 0.14), 3)

        return {
            "condition": detected["condition"],
            "category": detected["category"],
            "severity": detected["severity"],
            "confidence": confidence,
            "model_version": self.model_version,
            "dimensions": f"{metadata.get('width', 0)}x{metadata.get('height', 0)}",
            "file_size_kb": metadata.get("size_kb", 0)
        }

    def _analyze_image_features(self, image_bytes: bytes) -> Dict[str, Any]:
        """
        CPU-bound PIL parsing and channel analysis.
        """
        try:
            with Image.open(io.BytesIO(image_bytes)) as img:
                img_rgb = img.convert("RGB")
                width, height = img_rgb.size
                
                # Sample center crop for heuristic analysis
                small = img_rgb.resize((32, 32))
                pixels = list(small.getdata())
                r_avg = sum(p[0] for p in pixels) / len(pixels)
                g_avg = sum(p[1] for p in pixels) / len(pixels)
                b_avg = sum(p[2] for p in pixels) / len(pixels)

                # Heuristic index based on dominant color components
                if g_avg > 140 and r_avg < 100:
                    heuristic = 4  # Healthy
                elif r_avg > 150 and g_avg < 110:
                    heuristic = 1  # Bacterial Blight
                elif b_avg > 130 or (r_avg > 120 and g_avg > 120):
                    heuristic = 0  # Pest Infestation
                else:
                    heuristic = 2  # Early Blight Fungus

                return {
                    "width": width,
                    "height": height,
                    "size_kb": round(len(image_bytes) / 1024, 1),
                    "heuristic_index": heuristic
                }
        except Exception:
            # Fallback for synthetic / test payloads
            return {
                "width": 640,
                "height": 480,
                "size_kb": round(len(image_bytes) / 1024, 1),
                "heuristic_index": 0
            }

classifier_service = AsyncMLClassifier()
