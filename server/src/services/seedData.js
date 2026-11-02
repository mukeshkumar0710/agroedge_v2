/**
 * Historical Agricultural Telemetry Seeder.
 * Populates MongoDB with geographically dispersed crop pathology records
 * across key agricultural hubs in India to ensure immediate dashboard usability.
 */
const Incident = require('../models/Incident');
const { getLocalizedTreatment } = require('./localization');

const SAMPLE_INCIDENTS = [
  {
    id: 'init-inc-001',
    lat: 30.7333,
    lng: 76.7794, // Punjab / Chandigarh
    condition: 'BacterialBlight',
    category: 'Bacteriology',
    severity: 'CRITICAL',
    confidence: 0.96,
    treatment: 'Immediate Action: Spray Copper Oxychloride (2.5g/L). Drain standing water from the field.',
    lang: 'en'
  },
  {
    id: 'init-inc-002',
    lat: 30.9010,
    lng: 75.8573, // Ludhiana, Punjab
    condition: 'PestInfestation',
    category: 'Entomology',
    severity: 'HIGH',
    confidence: 0.91,
    treatment: 'Immediate Action: Spray 5% Neem Seed Kernel Extract. Install pheromone traps.',
    lang: 'hi'
  },
  {
    id: 'init-inc-003',
    lat: 18.5204,
    lng: 73.8567, // Pune, Maharashtra
    condition: 'EarlyBlightFungus',
    category: 'Mycology',
    severity: 'HIGH',
    confidence: 0.88,
    treatment: 'Immediate Action: Apply Mancozeb 75% WP (2g/L). Prune infected lower foliage.',
    lang: 'en'
  },
  {
    id: 'init-inc-004',
    lat: 19.9975,
    lng: 73.7898, // Nashik, Maharashtra
    condition: 'NutrientChlorosis',
    category: 'Agronomy',
    severity: 'MEDIUM',
    confidence: 0.89,
    treatment: 'Foliar spray of Ferrous Sulphate 0.5% + Citric Acid 0.1%.',
    lang: 'hi'
  },
  {
    id: 'init-inc-005',
    lat: 11.0168,
    lng: 76.9558, // Coimbatore, Tamil Nadu
    condition: 'PestInfestation',
    category: 'Entomology',
    severity: 'HIGH',
    confidence: 0.94,
    treatment: 'உடனடி நடவடிக்கை: மாலை வேளையில் 5% வேப்பங்கொட்டை கரைசல் தெளிக்கவும்.',
    lang: 'ta'
  },
  {
    id: 'init-inc-006',
    lat: 13.0827,
    lng: 80.2707, // Chennai, Tamil Nadu
    condition: 'HealthySample',
    category: 'Baseline',
    severity: 'LOW',
    confidence: 0.99,
    treatment: 'பராமரிப்பு நடவடிக்கை: நோய் அறிகுறிகள் இல்லை. வழக்கமான நீர்ப்பாசனம் தொடரவும்.',
    lang: 'ta'
  },
  {
    id: 'init-inc-007',
    lat: 17.3850,
    lng: 78.4867, // Hyderabad, Telangana
    condition: 'BacterialBlight',
    category: 'Bacteriology',
    severity: 'CRITICAL',
    confidence: 0.93,
    treatment: 'తక్షణ చర్య: కాపర్ ఆక్సిక్లోరైడ్ మరియు స్ట్రెప్టోసైక్లిన్ కలిపి పిచికారీ చేయండి.',
    lang: 'te'
  },
  {
    id: 'init-inc-008',
    lat: 22.5726,
    lng: 88.3639, // Kolkata / West Bengal
    condition: 'EarlyBlightFungus',
    category: 'Mycology',
    severity: 'HIGH',
    confidence: 0.87,
    treatment: 'অবিলম্বে ব্যবস্থা: ম্যানকোজেব ৭৫% ডব্লিউপি স্প্রে করুন।',
    lang: 'bn'
  }
];

const seedInitialData = async () => {
  try {
    const count = await Incident.countDocuments();
    if (count > 0) {
      console.log(`[Database Seed] Incident collection already contains ${count} records. Skipping seed.`);
      return;
    }

    const now = new Date().toISOString();
    const docs = SAMPLE_INCIDENTS.map((item) => {
      const loc = getLocalizedTreatment(item.condition, item.lang);
      return {
        id: item.id,
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [item.lng, item.lat] // RFC 7946: [lng, lat]
        },
        properties: {
          incident_id: item.id,
          condition: loc.title,
          category: item.category,
          confidence: item.confidence,
          severity: item.severity,
          treatment_plan: loc.treatment_plan || item.treatment,
          language: item.lang,
          timestamp: now,
          reported_lat: item.lat,
          reported_lng: item.lng,
          agent_id: 'seed-historical',
          file_size_kb: 342.5,
          dimensions: '1280x720'
        }
      };
    });

    await Incident.insertMany(docs);
    console.log(`[Database Seed] Successfully seeded ${docs.length} realistic telemetry records into MongoDB.`);
  } catch (error) {
    console.warn(`[Database Seed Warning] Seeding bypassed or failed: ${error.message}`);
  }
};

module.exports = {
  seedInitialData,
  SAMPLE_INCIDENTS
};
