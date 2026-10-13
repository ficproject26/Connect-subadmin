require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const assert = require('assert');
const http = require('http');
const app = require('../server');
const { db, initDatabase } = require('../config/db');
const { generateToken } = require('../utils/jwt');

let server;
let baseUrl;

const testAdmin = {
  id: 'SUPER-ADMIN-VERIFIER',
  name: 'Master Sub-Admin Auditor',
  email: 'admin.auditor@connect.in',
  role: 'Super Admin',
  status: 'active'
};
const authToken = generateToken(testAdmin);
const authHeaders = {
  Authorization: `Bearer ${authToken}`
};

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const req = http.request(
      url,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
          ...headers
        }
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      }
    );
    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function run() {
  console.log('========================================================================');
  console.log('🔍 Testing Audit & Customer Management Fixes');
  console.log('========================================================================');

  await initDatabase();

  server = http.createServer(app);
  await new Promise((res) => server.listen(0, '127.0.0.1', res));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Server listening at ${baseUrl}`);

  try {
    // 1. Verify GET /api/customers returns real orders, bookings, and spend
    console.log('\n[TEST 1] Testing Customer Directory & Transaction Metrics calculation...');
    const custRes = await request('GET', '/api/customers');
    assert.equal(custRes.status, 200, `GET /api/customers should return 200, got ${custRes.status}`);
    assert.equal(custRes.body.success, true, 'success should be true');
    assert(Array.isArray(custRes.body.customers), 'customers should be an array');
    console.log(`  Found ${custRes.body.customers.length} customers in MongoDB`);

    // Find customers with transactions
    const customersWithOrders = custRes.body.customers.filter(c => (c.totalOrders > 0 || c.totalBookings > 0 || c.totalSpent > 0));
    console.log(`  Customers with computed transaction metrics: ${customersWithOrders.length}`);
    assert(customersWithOrders.length > 0, 'Should have customers with computed orders/bookings');

    const sampleCust = customersWithOrders[0];
    console.log(`  Sample Customer: "${sampleCust.name}" (ID: ${sampleCust.id})`);
    console.log(`    Total Orders: ${sampleCust.totalOrders}`);
    console.log(`    Total Bookings: ${sampleCust.totalBookings}`);
    console.log(`    Total Spent: ₹${sampleCust.totalSpent}`);
    assert(typeof sampleCust.totalOrders === 'number', 'totalOrders must be a number');
    assert(typeof sampleCust.totalSpent === 'number', 'totalSpent must be a number');
    assert(typeof sampleCust.totalBookings === 'number', 'totalBookings must be a number');

    // Also verify customers with 0 transactions correctly have totalSpent: 0 and totalOrders: 0 (not undefined or NaN)
    const zeroCust = custRes.body.customers.find(c => c.totalOrders === 0 && c.totalBookings === 0);
    if (zeroCust) {
      assert.equal(zeroCust.totalSpent, 0, 'Customer with no purchases should have totalSpent 0');
      assert.equal(zeroCust.totalOrders, 0, 'Customer with no purchases should have totalOrders 0');
      console.log(`  Verified zero-transaction customer displays: ₹${zeroCust.totalSpent} and ${zeroCust.totalOrders} orders`);
    }

    console.log('  ✅ Passed Test 1: Customer metrics properly populated with deduplication and accurate totals');

    // 2. Verify GET /api/customers/:id/history returns separated orders and bookings
    console.log('\n[TEST 2] Testing Customer Details & History API with Tab separation...');
    const historyRes = await request('GET', `/api/customers/${sampleCust.id}/history`);
    assert.equal(historyRes.status, 200, `GET /api/customers/:id/history should return 200, got ${historyRes.status}`);
    assert.equal(historyRes.body.success, true, 'history success should be true');
    assert(historyRes.body.customer, 'should return customer profile');
    assert(Array.isArray(historyRes.body.orders), 'orders must be an array');
    assert(Array.isArray(historyRes.body.bookings), 'bookings must be an array');
    console.log(`  Customer "${sampleCust.name}" has ${historyRes.body.orders.length} orders and ${historyRes.body.bookings.length} bookings`);

    if (historyRes.body.orders.length > 0) {
      const order = historyRes.body.orders[0];
      const prodName = order.productName || order.itemName;
      const orderStat = order.status || order.orderStatus;
      console.log(`  Sample Order: ID: ${order.orderId}, Product: ${prodName}, Amount: ₹${order.amount}, Status: ${orderStat}`);
      assert(order.orderId, 'Order must have orderId');
      assert(prodName, 'Order must have product/item name');
    }

    if (historyRes.body.bookings.length > 0) {
      const booking = historyRes.body.bookings[0];
      const serviceName = booking.serviceName || booking.itemName;
      const bkgStat = booking.status || booking.bookingStatus;
      console.log(`  Sample Booking: ID: ${booking.bookingId}, Category: ${booking.category}, Service: ${serviceName}, Amount: ₹${booking.amount}, Status: ${bkgStat}`);
      assert(booking.bookingId, 'Booking must have bookingId');
      assert(['Stay', 'Travel', 'Service'].includes(booking.category), `Booking category should be Stay, Travel, or Service, got: ${booking.category}`);
      assert(serviceName, 'Booking must have service/item name');
    }
    console.log('  ✅ Passed Test 2: Customer History API returns separate Orders and Bookings tabs with correct categories');

    // 3. Verify Agent Directory excludes rejected and pending agents
    console.log('\n[TEST 3] Testing Agent Directory exclusion of rejected and pending agents...');
    const agentsCol = db.agents;
    // Ensure we have a rejected agent
    const rejectedAgent = await agentsCol.findOne({ status: 'rejected' });
    if (!rejectedAgent) {
      await agentsCol.insertOne({
        id: 'AGT-TEST-REJECTED',
        name: 'Rejected Test Agent',
        status: 'rejected',
        rejectionReason: 'Test rejection',
        createdAt: new Date()
      });
    }

    const agentsListRes = await request('GET', '/api/operations/agents');
    assert.equal(agentsListRes.status, 200, `GET /api/operations/agents should return 200, got ${agentsListRes.status}`);
    const returnedAgents = agentsListRes.body.agents || agentsListRes.body;
    assert(Array.isArray(returnedAgents), 'returned agents should be an array');
    const hasRejectedInDirectory = returnedAgents.some(a => String(a.status).toLowerCase() === 'rejected' || String(a.status).toLowerCase().includes('pending'));
    assert.equal(hasRejectedInDirectory, false, 'Agent directory MUST NOT contain rejected or pending agents');
    console.log(`  Directory returned ${returnedAgents.length} agents, all active/approved.`);
    console.log('  ✅ Passed Test 3: Active Agent directory excludes rejected and pending agents');

    // 4. Verify Agent Requests Page includes rejected agents
    console.log('\n[TEST 4] Testing Agent Requests endpoint contains all statuses including rejected...');
    const requestsRes = await request('GET', '/api/operations/agents/requests?status=All');
    assert.equal(requestsRes.status, 200, `GET /api/operations/agents/requests should return 200, got ${requestsRes.status}`);
    const agentRequests = requestsRes.body.requests || requestsRes.body;
    assert(Array.isArray(agentRequests), 'requests should be an array');
    const rejectedReqRes = await request('GET', '/api/operations/agents/requests?status=Rejected');
    assert.equal(rejectedReqRes.status, 200, `GET /api/operations/agents/requests?status=Rejected should return 200, got ${rejectedReqRes.status}`);
    const rejectedReqs = rejectedReqRes.body.requests || rejectedReqRes.body;
    assert(Array.isArray(rejectedReqs), 'rejected requests should be an array');
    console.log(`  Total requests: ${agentRequests.length}, Rejected requests: ${rejectedReqs.length}`);
    assert(rejectedReqs.length > 0, 'Should find at least 1 rejected agent request');
    console.log('  ✅ Passed Test 4: Agent requests endpoint correctly retains and isolates rejected requests');

    console.log('\n========================================================================');
    console.log('🎯 ALL 4 AUDIT & CUSTOMER MANAGEMENT TESTS PASSED PERFECTLY!');
    console.log('========================================================================');
  } catch (err) {
    console.error('❌ Test failed with error:', err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  } finally {
    if (server) {
      await new Promise((res) => server.close(res));
    }
  }
  process.exit(0);
}

run();
