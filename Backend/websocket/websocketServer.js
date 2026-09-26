/**
 * Centralized WebSocket Server
 * Handles secure real-time bidirectional communication with frontend applications.
 * Implements JWT authentication, role/geo scope filtering, heartbeats,
 * event deduplication, and missed-event synchronization on reconnection.
 */

const { WebSocketServer, WebSocket } = require('ws');
const url = require('url');
const { verifyToken } = require('../utils/jwt');
const eventPublisher = require('../events/eventPublisher');
const { setWebSocketBroadcaster } = require('../events/eventSubscriber');

// Connected clients storage: Map<WebSocket, ClientContext>
const connectedClients = new Map();

// Telemetry & metrics
const wsMetrics = {
  activeConnections: 0,
  authenticatedConnections: 0,
  totalEventsBroadcast: 0,
  totalMessagesSent: 0,
  totalAcksReceived: 0,
  averageClientLatencyMs: 0,
  latenciesRecorded: []
};

/**
 * Determine if an event is in scope for an authenticated WebSocket user
 */
function isEventInUserScope(event, user) {
  if (!user) return false;
  const role = (user.role || '').toLowerCase();

  // Super Admin / All India State Admin receives all events
  if (
    role.includes('super admin') ||
    role === 'admin' ||
    (role.includes('state') && (!user.state || user.state === 'All India'))
  ) {
    return true;
  }

  const scope = event.scope || {};

  // If directly targeted to another user ID
  const userId = String(user.id || user._id || '');
  if (scope.targetUserId && String(scope.targetUserId) !== userId) {
    return false;
  }

  // If targeted to specific roles
  if (scope.targetRoles && scope.targetRoles.length > 0) {
    const roleMatches = scope.targetRoles.some(r => role.includes(r.toLowerCase()));
    if (!roleMatches) return false;
  }

  // Global / unscoped events are allowed for all
  if (!scope.state && !scope.district && !scope.division && !scope.pincode) {
    return true;
  }

  const uState = (user.state || '').trim().toLowerCase();
  const uDist = (user.district || '').trim().toLowerCase();
  const uDiv = (user.division || '').trim().toLowerCase();
  const uPin = String(user.pincode || '').trim();

  // State Admin: matches if in same state
  if (role.includes('state') && !role.includes('district') && !role.includes('division') && !role.includes('pincode')) {
    if (!scope.state || !uState) return true;
    return scope.state.toLowerCase() === uState;
  }

  // District Admin: matches if in same district
  if (role.includes('district') && !role.includes('division') && !role.includes('pincode')) {
    if (!scope.district || !uDist) return true;
    return scope.district.toLowerCase() === uDist;
  }

  // Division Admin: matches if in same division
  if (role.includes('division') || role.includes('divisional')) {
    if (!scope.division || !uDiv) return true;
    return scope.division.toLowerCase() === uDiv;
  }

  // Pincode Admin: matches if in same pincode
  if (role.includes('pincode')) {
    if (!scope.pincode || !uPin) return true;
    return String(scope.pincode) === uPin;
  }

  // Field Managers
  if (role.includes('manager')) {
    if (scope.pincode && uPin && String(scope.pincode) === uPin) return true;
    if (scope.division && uDiv && scope.division.toLowerCase() === uDiv) return true;
    if (scope.district && uDist && scope.district.toLowerCase() === uDist) return true;
    if (!scope.pincode && !scope.district && !scope.division) return true;
  }

  return false;
}

/**
 * Initialize WebSocket Server attached to an existing Node.js HTTP/S server
 */
function initWebSocketServer(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  // Handle HTTP upgrade requests for /ws path
  httpServer.on('upgrade', (request, socket, head) => {
    const parsedUrl = new URL(request.url, 'http://localhost');
    const pathname = parsedUrl.pathname;

    // Support both /ws and /api/ws for proxy compatibility
    if (pathname === '/ws' || pathname === '/api/ws' || pathname.endsWith('/ws')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  // Client connection handler
  wss.on('connection', (ws, request) => {
    const parsedUrl = new URL(request.url, 'http://localhost');
    const token = parsedUrl.searchParams.get('token') || (request.headers['sec-websocket-protocol'] || '').split(',')[0].trim();

    const clientContext = {
      ws,
      user: null,
      authenticated: false,
      isAlive: true,
      connectedAt: new Date(),
      subscribedEntities: new Set(),
      remoteAddress: request.socket.remoteAddress
    };

    connectedClients.set(ws, clientContext);
    wsMetrics.activeConnections = connectedClients.size;

    // Attempt instant authentication via token in connection params
    if (token) {
      authenticateClient(ws, token);
    }

    // Ping / Pong heartbeat monitoring
    ws.on('pong', () => {
      clientContext.isAlive = true;
    });

    // Incoming messages from frontend
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        handleClientMessage(ws, msg);
      } catch (err) {
        console.warn('[WebSocket] Malformed message received:', err.message);
      }
    });

    // Cleanup on disconnect
    ws.on('close', (code, reason) => {
      connectedClients.delete(ws);
      wsMetrics.activeConnections = connectedClients.size;
      wsMetrics.authenticatedConnections = Array.from(connectedClients.values()).filter(c => c.authenticated).length;
    });

    ws.on('error', (err) => {
      connectedClients.delete(ws);
      wsMetrics.activeConnections = connectedClients.size;
    });

    // Send connection greeting
    sendMessage(ws, {
      type: 'SERVER_HELLO',
      serverTime: new Date().toISOString(),
      requiresAuth: !clientContext.authenticated
    });
  });

  // Periodic heartbeat interval (every 25s)
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const client = connectedClients.get(ws);
      if (!client) return;

      if (!client.isAlive) {
        ws.terminate();
        connectedClients.delete(ws);
        return;
      }

      client.isAlive = false;
      try {
        ws.ping();
      } catch (e) {
        ws.terminate();
        connectedClients.delete(ws);
      }
    });
    wsMetrics.activeConnections = connectedClients.size;
  }, 25000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  // Connect broadcaster to Redis Event Subscriber
  setWebSocketBroadcaster(broadcastEvent);

  console.log('⚡ [WebSocketServer] Centralized Real-Time WebSocket server initialized on /ws');
  return wss;
}

/**
 * Authenticate client socket via JWT token
 */
function authenticateClient(ws, token) {
  const client = connectedClients.get(ws);
  if (!client) return false;

  try {
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (e) {
      // Fallback secret for manager tokens
      const jwt = require('jsonwebtoken');
      decoded = jwt.verify(token, 'super_secret_agent_manager_jwt_key_2026');
    }

    client.user = decoded;
    client.authenticated = true;
    wsMetrics.authenticatedConnections = Array.from(connectedClients.values()).filter(c => c.authenticated).length;

    sendMessage(ws, {
      type: 'AUTH_SUCCESS',
      user: {
        id: decoded.id || decoded._id,
        name: decoded.name,
        role: decoded.role,
        state: decoded.state,
        district: decoded.district,
        division: decoded.division,
        pincode: decoded.pincode
      }
    });
    return true;
  } catch (err) {
    sendMessage(ws, {
      type: 'AUTH_ERROR',
      message: 'Authentication failed. Invalid or expired token.'
    });
    return false;
  }
}

/**
 * Handle incoming message commands from clients
 */
function handleClientMessage(ws, msg) {
  const client = connectedClients.get(ws);
  if (!client) return;

  switch (msg.type) {
    case 'AUTH':
      authenticateClient(ws, msg.token);
      break;

    case 'PING':
      sendMessage(ws, { type: 'PONG', timestamp: new Date().toISOString() });
      break;

    case 'SUBSCRIBE':
      if (Array.isArray(msg.entities)) {
        msg.entities.forEach(e => client.subscribedEntities.add(e.toLowerCase()));
      }
      sendMessage(ws, {
        type: 'SUBSCRIBED',
        entities: Array.from(client.subscribedEntities)
      });
      break;

    case 'SYNC_STATE':
      // Client requesting catchup of missed events after reconnect
      if (client.authenticated) {
        const missedEvents = eventPublisher.getEventsSince(msg.lastEventTimestamp || msg.lastVersion);
        // Filter missed events to client's scope
        const scopedMissed = missedEvents.filter(ev => isEventInUserScope(ev, client.user));
        sendMessage(ws, {
          type: 'SYNC_EVENTS',
          count: scopedMissed.length,
          events: scopedMissed,
          serverTimestamp: new Date().toISOString()
        });
      }
      break;

    case 'ACK':
      if (msg.eventId && msg.clientTimestamp) {
        wsMetrics.totalAcksReceived++;
        const latency = Date.now() - new Date(msg.clientTimestamp).getTime();
        if (latency >= 0 && latency < 60000) {
          wsMetrics.latenciesRecorded.push(latency);
          if (wsMetrics.latenciesRecorded.length > 100) wsMetrics.latenciesRecorded.shift();
          const sum = wsMetrics.latenciesRecorded.reduce((a, b) => a + b, 0);
          wsMetrics.averageClientLatencyMs = Math.round(sum / wsMetrics.latenciesRecorded.length);
        }
      }
      break;

    default:
      break;
  }
}

/**
 * Safely send a message to a WebSocket client
 */
function sendMessage(ws, message) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      const payload = typeof message === 'string' ? message : JSON.stringify(message);
      ws.send(payload);
      wsMetrics.totalMessagesSent++;
    } catch (e) {
      console.warn('[WebSocket] Send failed:', e.message);
    }
  }
}

/**
 * Broadcast an event to all authorized and in-scope connected clients
 */
function broadcastEvent(event) {
  if (!event) return;

  const serialized = JSON.stringify({
    type: 'EVENT',
    ...event
  });

  let deliveredCount = 0;

  for (const [ws, client] of connectedClients.entries()) {
    if (ws.readyState !== WebSocket.OPEN) continue;
    if (!client.authenticated) continue;

    // Check entity subscription if client explicitly specified entities
    if (client.subscribedEntities.size > 0 && event.entity) {
      if (!client.subscribedEntities.has(event.entity.toLowerCase()) && !client.subscribedEntities.has('*')) {
        continue;
      }
    }

    // Check geographic & role authorization
    if (isEventInUserScope(event, client.user)) {
      try {
        ws.send(serialized);
        deliveredCount++;
      } catch (err) {
        // Socket write error handled
      }
    }
  }

  wsMetrics.totalEventsBroadcast++;
}

function getWebSocketMetrics() {
  return {
    ...wsMetrics,
    totalConnections: connectedClients.size,
    authenticatedUsers: Array.from(connectedClients.values())
      .filter(c => c.authenticated)
      .map(c => ({
        id: c.user?.id || c.user?._id,
        role: c.user?.role,
        state: c.user?.state,
        district: c.user?.district
      }))
  };
}

module.exports = {
  initWebSocketServer,
  broadcastEvent,
  getWebSocketMetrics
};
