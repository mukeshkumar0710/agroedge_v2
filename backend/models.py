"""
Pydantic schemas and GeoJSON RFC 7946 compliant models.
"""
from typing import List, Dict, Any, Optional, Literal
from pydantic import BaseModel, Field

class GeoJSONGeometry(BaseModel):
    type: Literal["Point"] = "Point"
    # IMPORTANT: RFC 7946 specifies coordinates as [longitude, latitude]
    coordinates: List[float] = Field(..., description="[longitude, latitude]")

class IncidentProperties(BaseModel):
    incident_id: str
    condition: str
    category: str
    confidence: float
    severity: Literal["CRITICAL", "HIGH", "MEDIUM", "LOW"]
    treatment_plan: str
    language: str
    timestamp: str
    reported_lat: float
    reported_lng: float
    agent_id: Optional[str] = "field-edge-node"

class GeoJSONFeature(BaseModel):
    type: Literal["Feature"] = "Feature"
    id: str
    geometry: GeoJSONGeometry
    properties: IncidentProperties

class GeoJSONFeatureCollection(BaseModel):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: List[GeoJSONFeature]

class IngestionResponse(BaseModel):
    client_incident_id: str
    status: Literal["queued", "acknowledged_duplicate", "error"]
    message: str
    received_at: str
    diagnosis: Optional[Dict[str, Any]] = None


class SimulationRequest(BaseModel):
    condition: Optional[str] = None
    severity: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    language_code: Optional[str] = "en"
