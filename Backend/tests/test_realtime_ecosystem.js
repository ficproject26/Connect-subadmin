/**
 * Comprehensive Real-Time Ecosystem Test Suite
 * Measures latency, tests multi-client broadcast, deduplication, versioning,
 * scope filtering, cache invalidation, and reconnection catch-up.
 */

const http = require('http');
const WebSocket = require('ws');
const { generateToken } = require('../utils/jwt');
const { db } = require('../config/db');
const cacheManager = require('../redis/cacheManager');
const eventPublisher = require('../events/eventPublisher');
const app = require('../server');

async function runTestSuite() {
  console.log('================================================================');
  console.log('🧪 Starting Real-Time Ecosystem Verification & Latency Benchmark');
  console.log('================================================================\n');

  const testPort = 8019;
  const server = app.server || http.createServer(app);

  await new Promise((resolve) => {
    server.listen(testPort, '127.0.0.1', () => {
      console.log(`✅ Test server running on http://127.0.0.1:${testPort}`);
      resolve();
    });
  });

  const wsUrl = `ws://127.0.0.1:${testPort}/ws`;

  // Create test tokens
  const superAdminToken = generateToken({
    id: 'super_admin_test_1',
    name: 'Super Admin',
    role: 'Super Admin',
    status: 'active'
  });

  const tnStateAdminToken = generateToken({
    id: 'state_admin_test_1',
    name: 'TN State Admin',
    role: 'State Admin',
    state: 'Tamil Nadu',
    status: 'active'
  });

  const salemDistrictAdminToken = generateToken({
    id: 'district_admin_test_1',
    name: 'Salem Admin',
    role: 'District Admin',
    state: 'Tamil Nadu',
    district: 'Salem',
    status: 'active'
  });

  const otherStateAdminToken = generateToken({
    id: 'kerala_admin_test_1',
    name: 'Kerala Admin',
    role: 'State Admin',
    state: 'Kerala',
    status: 'active'
  });

  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      testsPassed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      testsFailed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // Test 1: Unauthorized Client Rejection
    // -------------------------------------------------------------
    console.log('📋 Test 1: WebSocket Authentication & Token Validation');
    await new Promise((resolve) => {
      const badWs = new WebSocket(`${wsUrl}?token=invalid_token_12345`);
      badWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'AUTH_ERROR') {
          assert(true, 'Invalid token received AUTH_ERROR response');
          badWs.close();
          resolve();
        }
      });
      badWs.on('error', () => {
        assert(true, 'Connection without valid token rejected or errored');
        resolve();
      });
      setTimeout(() => {
        badWs.close();
        resolve();
      }, 1000);
    });

    // -------------------------------------------------------------
    // Test 2: Multi-Client Connection & Scope-Filtered Broadcast
    // -------------------------------------------------------------
    console.log('\n📋 Test 2: Multi-Client Simultaneous Connection & Geographic Scoping');
    const clientSuper = new WebSocket(`${wsUrl}?token=${superAdminToken}`);
    const clientTN = new WebSocket(`${wsUrl}?token=${tnStateAdminToken}`);
    const clientSalem = new WebSocket(`${wsUrl}?token=${salemDistrictAdminToken}`);
    const clientKerala = new WebSocket(`${wsUrl}?token=${otherStateAdminToken}`);

    await Promise.all([
      new Promise(r => clientSuper.on('open', r)),
      new Promise(r => clientTN.on('open', r)),
      new Promise(r => clientSalem.on('open', r)),
      new Promise(r => clientKerala.on('open', r))
    ]);
    assert(true, '4 diverse clients connected simultaneously');

    // Wait a brief moment for auth handshake
    await new Promise(r => setTimeout(r, 200));

    // Listen for scoped events
    const receivedEvents = {
      super: [],
      tn: [],
      salem: [],
      kerala: []
    };

    clientSuper.on('message', d => {
      const m = JSON.parse(d.toString());
      if (m.type === 'EVENT') receivedEvents.super.push(m);
    });
    clientTN.on('message', d => {
      const m = JSON.parse(d.toString());
      if (m.type === 'EVENT') receivedEvents.tn.push(m);
    });
    clientSalem.on('message', d => {
      const m = JSON.parse(d.toString());
      if (m.type === 'EVENT') receivedEvents.salem.push(m);
    });
    clientKerala.on('message', d => {
      const m = JSON.parse(d.toString());
      if (m.type === 'EVENT') receivedEvents.kerala.push(m);
    });

    // -------------------------------------------------------------
    // Test 3: End-to-End Latency Measurement on Database Mutation
    // -------------------------------------------------------------
    console.log('\n📋 Test 3: End-to-End Latency Measurement (Database Mutation -> WebSocket Receipt)');
    const t0 = Date.now();
    const testEntityId = `test_vendor_${Date.now()}`;

    // Perform database insertion through Collection
    const insertedVendor = await db.vendors.insertOne({
      id: testEntityId,
      name: 'Real-Time Benchmark Store',
      state: 'Tamil Nadu',
      district: 'Salem',
      division: 'Salem Urban',
      pincode: '636001',
      status: 'Active',
      kycStatus: 'Verified'
    });

    // Wait for event to arrive at clientSalem
    const eventPromise = new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const found = receivedEvents.salem.find(e => e.entityId === testEntityId);
        if (found) {
          clearInterval(checkInterval);
          const latency = Date.now() - t0;
          resolve(latency);
        }
      }, 5);
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(-1);
      }, 3000);
    });

    const latencyMs = await eventPromise;
    assert(latencyMs > 0 && latencyMs < 500, `End-to-end propagation latency: ${latencyMs}ms (Target: < 500ms)`);
    assert(latencyMs <= 1000, `Latency satisfies normal maximum target (~1 second)`);

    // Verify Scope Isolation:
    // Kerala admin must NOT receive Salem vendor update
    await new Promise(r => setTimeout(r, 200));
    const keralaReceivedSalem = receivedEvents.kerala.some(e => e.entityId === testEntityId);
    assert(!keralaReceivedSalem, 'Geographic scope isolation verified: Kerala Admin did NOT receive Salem vendor event');

    // Super Admin MUST receive Salem vendor update
    const superReceivedSalem = receivedEvents.super.some(e => e.entityId === testEntityId);
    assert(superReceivedSalem, 'Super Admin received the scoped vendor event');

    // TN State Admin MUST receive Salem vendor update
    const tnReceivedSalem = receivedEvents.tn.some(e => e.entityId === testEntityId);
    assert(tnReceivedSalem, 'TN State Admin received the Salem vendor event');

    // -------------------------------------------------------------
    // Test 4: Cache Invalidation on State Mutation
    // -------------------------------------------------------------
    console.log('\n📋 Test 4: Real-Time Cache Invalidation');
    const cacheKey = cacheManager.makeKey('vendors', 'list_all');
    await cacheManager.set(cacheKey, { count: 42, test: true }, 300);
    const cachedBefore = await cacheManager.get(cacheKey);
    assert(cachedBefore !== null && cachedBefore.count === 42, 'Cache entry was successfully stored');

    // Update the vendor
    await db.vendors.updateOne({ id: testEntityId }, { status: 'Suspended' });
    await new Promise(r => setTimeout(r, 100));

    const cachedAfter = await cacheManager.get(cacheKey);
    assert(cachedAfter === null, 'Cache was automatically invalidated upon entity update');

    // Clean up test vendor
    await db.vendors.deleteOne({ id: testEntityId });

    // -------------------------------------------------------------
    // Test 5: Event Deduplication
    // -------------------------------------------------------------
    console.log('\n📋 Test 5: Event Deduplication');
    const dedup1 = await eventPublisher.publishEntityEvent('orders', 'updated', { id: 'dup_order_1', status: 'Pending' }, 'dup_order_1');
    const dedup2 = await eventPublisher.publishEntityEvent('orders', 'updated', { id: 'dup_order_1', status: 'Pending' }, 'dup_order_1');
    assert(dedup1 !== null, 'First event generated successfully');
    assert(dedup2 === null, 'Rapid duplicate event was successfully deduplicated and dropped');

    // -------------------------------------------------------------
    // Test 6: Reconnection Catch-up & State Sync
    // -------------------------------------------------------------
    console.log('\n📋 Test 6: WebSocket Reconnection Catch-up (SYNC_STATE)');
    const catchupClient = new WebSocket(`${wsUrl}?token=${superAdminToken}`);
    await new Promise(r => catchupClient.on('open', r));

    const syncPromise = new Promise((resolve) => {
      catchupClient.on('message', (d) => {
        const msg = JSON.parse(d.toString());
        if (msg.type === 'SYNC_EVENTS') {
          resolve(msg);
        }
      });
    });

    // Ask server for events since 1 minute ago
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    catchupClient.send(JSON.stringify({
      type: 'SYNC_STATE',
      lastEventTimestamp: oneMinuteAgo
    }));

    const syncResult = await syncPromise;
    assert(syncResult && Array.isArray(syncResult.events), `Received ${syncResult.events.length} catchup events upon reconnect`);
    catchupClient.close();

    // -------------------------------------------------------------
    // Test 7: High Concurrency (20 Simultaneous Clients)
    // -------------------------------------------------------------
    console.log('\n📋 Test 7: High Concurrency Fanout (20 Simultaneous Connected Clients)');
    const pool = [];
    const poolReceived = new Array(20).fill(0);

    for (let i = 0; i < 20; i++) {
      const ws = new WebSocket(`${wsUrl}?token=${superAdminToken}`);
      const idx = i;
      ws.on('message', (d) => {
        const msg = JSON.parse(d.toString());
        if (msg.type === 'EVENT' && msg.entityId === 'benchmark_order_100') {
          poolReceived[idx]++;
        }
      });
      pool.push(ws);
    }

    await Promise.all(pool.map(ws => new Promise(r => ws.on('open', r))));
    await new Promise(r => setTimeout(r, 200));

    const benchT0 = Date.now();
    await eventPublisher.publishEntityEvent('orders', 'created', {
      id: 'benchmark_order_100',
      totalAmount: 1500,
      status: 'Placed'
    }, 'benchmark_order_100');

    await new Promise(r => setTimeout(r, 300));
    const allReceived = poolReceived.every(count => count >= 1);
    const benchLatency = Date.now() - benchT0;
    assert(allReceived, `All 20 simultaneous clients received the broadcast event in ${benchLatency}ms`);

    pool.forEach(ws => ws.close());
    clientSuper.close();
    clientTN.close();
    clientSalem.close();
    clientKerala.close();

  } catch (err) {
    console.error('Test error:', err);
    testsFailed++;
  } finally {
    server.close();
  }

  console.log('\n================================================================');
  console.log(`📊 Test Results: ${testsPassed} passed, ${testsFailed} failed`);
  console.log('================================================================');

  if (testsFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite();
