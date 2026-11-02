/**
 * Comprehensive Automated Test Suite for AgroEdge MERN Stack.
 * Validates ML classifier, Localization, API Endpoints, and React static delivery.
 */
process.env.NODE_ENV = 'test';
const http = require('http');
const assert = require('assert');
const { mlClassifier } = require('../src/services/mlPipeline');
const { getLocalizedTreatment, LOCALIZED_TREATMENTS } = require('../src/services/localization');
const { app } = require('../src/server');

async function runTests() {
  console.log('====================================================');
  console.log('🧪 Starting AgroEdge MERN Stack Test Suite');
  console.log('====================================================\n');

  // Test 1: Machine Learning Classifier
  console.log('▶ Test 1: ML Pipeline Image Classification...');
  const dummyBuffer = Buffer.from([200, 50, 50, 180, 40, 40, 190, 45, 45]); // Red-dominant dummy pixels
  const prediction = await mlClassifier.predictImage(dummyBuffer);

  assert.ok(prediction.condition, 'Prediction must include condition');
  assert.ok(prediction.category, 'Prediction must include category');
  assert.ok(prediction.severity, 'Prediction must include severity');
  assert.ok(prediction.confidence >= 0.8 && prediction.confidence <= 1.0, 'Confidence must be within 0.8 - 1.0');
  console.log(`  ✔ PASS: ML Classified condition="${prediction.condition}" (Confidence: ${prediction.confidence}, Severity: ${prediction.severity})\n`);

  // Test 2: Localization Service across 6 Languages
  console.log('▶ Test 2: Multi-Lingual Localization Engine...');
  const testLangs = ['en', 'hi', 'ta', 'te', 'es', 'bn'];
  for (const lang of testLangs) {
    const loc = getLocalizedTreatment('BacterialBlight', lang);
    assert.ok(loc.title, `Title must exist for ${lang}`);
    assert.ok(loc.treatment_plan, `Treatment plan must exist for ${lang}`);
    assert.strictEqual(loc.language_applied, lang, `Language applied must be ${lang}`);
  }
  console.log('  ✔ PASS: Verified clinical translations across EN, HI, TA, TE, ES, BN.\n');

  // Test 3: Express HTTP Server & Endpoints
  console.log('▶ Test 3: Express Server HTTP Endpoints...');
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  console.log(`  ℹ Ephemeral test server listening on port ${port}`);

  function makeRequest(path, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
      const postData = body ? JSON.stringify(body) : null;
      const options = {
        hostname: '127.0.0.1',
        port: port,
        path: path,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {})
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        });
      });

      req.on('error', reject);
      if (postData) req.write(postData);
      req.end();
    });
  }

  try {
    // 3a. Health Endpoint
    const healthRes = await makeRequest('/api/v1/health');
    assert.ok([200, 503].includes(healthRes.status), `Health endpoint status code: ${healthRes.status}`);
    const healthJson = JSON.parse(healthRes.body);
    assert.strictEqual(healthJson.stack, 'MERN (MongoDB, Express, React, Node.js)');
    assert.strictEqual(healthJson.database.type, 'MongoDB');
    console.log(`  ✔ PASS: /api/v1/health responded with stack="${healthJson.stack}"`);

    // 3b. API Directory Info
    const apiRes = await makeRequest('/api');
    assert.strictEqual(apiRes.status, 200);
    const apiJson = JSON.parse(apiRes.body);
    assert.strictEqual(apiJson.version, '2.0.0');
    console.log('  ✔ PASS: /api returned version 2.0.0 and service endpoint index.');

    // 3c. Simulation Endpoint
    const simRes = await makeRequest('/api/v1/simulate-incident', 'POST', {
      condition: 'PestInfestation',
      severity: 'HIGH',
      latitude: 28.7041,
      longitude: 77.1025,
      language_code: 'hi'
    });
    assert.strictEqual(simRes.status, 200);
    const simJson = JSON.parse(simRes.body);
    assert.strictEqual(simJson.status, 'broadcasted');
    assert.strictEqual(simJson.feature.geometry.type, 'Point');
    assert.deepStrictEqual(simJson.feature.geometry.coordinates, [77.1025, 28.7041]);
    console.log('  ✔ PASS: /api/v1/simulate-incident created valid GeoJSON Point [77.1025, 28.7041].');

    // 3d. GeoJSON FeatureCollection Retrieval
    const geoRes = await makeRequest('/api/v1/incidents/geojson');
    assert.strictEqual(geoRes.status, 200);
    const geoJson = JSON.parse(geoRes.body);
    assert.strictEqual(geoJson.type, 'FeatureCollection');
    assert.ok(Array.isArray(geoJson.features));
    console.log(`  ✔ PASS: /api/v1/incidents/geojson returned RFC 7946 FeatureCollection.`);

    // 3e. React Static Client Delivery
    const rootRes = await makeRequest('/');
    assert.strictEqual(rootRes.status, 200);
    assert.ok(rootRes.body.includes('AgroEdge'), 'Root HTML should contain AgroEdge title');
    assert.ok(rootRes.body.includes('<div id="root">'), 'Root HTML must contain React root container');
    console.log('  ✔ PASS: GET / successfully serves compiled React 18 production bundle.');

  } finally {
    server.close();
  }

  console.log('\n====================================================');
  console.log('🎉 ALL AGROEDGE MERN STACK TESTS PASSED SUCCESSFULLY!');
  console.log('====================================================');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('\n❌ Test Failure:', err);
  process.exit(1);
});
