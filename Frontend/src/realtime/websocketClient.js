/**
 * Centralized Frontend Real-Time WebSocket Client
 * Connects to the backend WebSocket layer, maintains auto-reconnect with backoff,
 * handles token auth, heartbeat ping/pong, event deduplication, and
 * catchup state sync on reconnect.
 */

import { API_BASE_URL } from '../services/api';

export const ConnectionStatus = {
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  RECONNECTING: 'reconnecting'
};

class RealtimeWebSocketClient {
  constructor() {
    this.ws = null;
    this.status = ConnectionStatus.DISCONNECTED;
    this.listeners = new Map(); // entity/channel -> Set<callback>
    this.statusListeners = new Set();
    this.reconnectAttempt = 0;
    this.maxReconnectDelay = 10000;
    this.reconnectTimer = null;
    this.pingTimer = null;
    this.lastEventTimestamp = null;
    this.lastEventVersion = 0;
    this.recentEventIds = new Set();
    this.entityVersions = new Map(); // entityId -> version
    this.isExplicitlyClosed = false;
  }

  /**
   * Determine the WebSocket URL from API_BASE_URL or current browser origin
   */
  getWebSocketUrl() {
    const token = localStorage.getItem('ams_token') || '';
    let wsBase;

    if (API_BASE_URL) {
      // Convert http(s) URL to ws(s)
      wsBase = API_BASE_URL.replace(/^http:\/\//i, 'ws://').replace(/^https:\/\//i, 'wss://');
    } else {
      const loc = window.location;
      const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
      // In Vite dev mode, backend is typically on port 8006
      if (loc.port === '5173' || loc.port === '3000') {
        wsBase = `${protocol}//${loc.hostname}:8006`;
      } else {
        wsBase = `${protocol}//${loc.host}`;
      }
    }

    const cleanBase = wsBase.replace(/\/+$/, '');
    const wsPath = cleanBase.endsWith('/api') ? `${cleanBase}/ws` : `${cleanBase}/ws`;
    return `${wsPath}?token=${encodeURIComponent(token)}`;
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    const token = localStorage.getItem('ams_token');
    if (!token) {
      this.setStatus(ConnectionStatus.DISCONNECTED);
      return;
    }

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isExplicitlyClosed = false;
    this.setStatus(this.reconnectAttempt > 0 ? ConnectionStatus.RECONNECTING : ConnectionStatus.CONNECTING);

    const url = this.getWebSocketUrl();

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.reconnectAttempt = 0;
        this.setStatus(ConnectionStatus.CONNECTED);
        this.startHeartbeat();

        // If we previously had events, request catchup of any events missed during disconnect
        if (this.lastEventTimestamp || this.lastEventVersion > 0) {
          this.send({
            type: 'SYNC_STATE',
            lastEventTimestamp: this.lastEventTimestamp,
            lastVersion: this.lastEventVersion
          });
        }
      };

      this.ws.onmessage = (messageEvent) => {
        this.handleIncomingMessage(messageEvent.data);
      };

      this.ws.onclose = (event) => {
        this.stopHeartbeat();
        this.setStatus(ConnectionStatus.DISCONNECTED);

        if (!this.isExplicitlyClosed) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (err) => {
        // Handled silently; onclose will schedule reconnect
        this.setStatus(ConnectionStatus.DISCONNECTED);
      };
    } catch (err) {
      console.warn('[RealTimeWS] Connection attempt failed:', err.message);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect manually
   */
  disconnect() {
    this.isExplicitlyClosed = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }
    this.setStatus(ConnectionStatus.DISCONNECTED);
  }

  scheduleReconnect() {
    if (this.reconnectTimer || this.isExplicitlyClosed) return;

    this.reconnectAttempt++;
    // Exponential backoff with jitter
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempt) + Math.random() * 500, this.maxReconnectDelay);

    this.setStatus(ConnectionStatus.RECONNECTING);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'PING' });
      }
    }, 20000);
  }

  stopHeartbeat() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        const payload = typeof data === 'string' ? data : JSON.stringify(data);
        this.ws.send(payload);
      } catch (e) {
        console.warn('[RealTimeWS] Send failed:', e.message);
      }
    }
  }

  handleIncomingMessage(rawData) {
    try {
      const msg = JSON.parse(rawData);
      if (!msg) return;

      // Handle server control messages
      if (msg.type === 'PONG' || msg.type === 'SERVER_HELLO' || msg.type === 'AUTH_SUCCESS') {
        return;
      }

      // Handle missed events catchup
      if (msg.type === 'SYNC_EVENTS' && Array.isArray(msg.events)) {
        msg.events.forEach(evt => this.processEvent(evt, true));
        return;
      }

      // Handle real-time broadcast event
      if (msg.type === 'EVENT' || msg.event) {
        this.processEvent(msg, false);
      }
    } catch (err) {
      console.warn('[RealTimeWS] Message parse error:', err.message);
    }
  }

  processEvent(event, isCatchup = false) {
    if (!event || !event.id) return;

    // Deduplicate against recently received event IDs
    if (this.recentEventIds.has(event.id)) {
      return;
    }
    this.recentEventIds.add(event.id);
    if (this.recentEventIds.size > 1000) {
      const first = this.recentEventIds.values().next().value;
      this.recentEventIds.delete(first);
    }

    // Out-of-order version check: discard older event if a newer version was already processed for this entityId
    if (event.entityId && event.version) {
      const lastVersion = this.entityVersions.get(event.entityId);
      if (lastVersion && event.version < lastVersion) {
        return; // Stale out-of-order event
      }
      this.entityVersions.set(event.entityId, event.version);
    }

    // Update highest seen timestamp and version
    if (event.timestamp) {
      this.lastEventTimestamp = event.timestamp;
    }
    if (event.version && event.version > this.lastEventVersion) {
      this.lastEventVersion = event.version;
    }

    // Send lightweight acknowledgement with latency telemetry
    if (!isCatchup && event.timestamp) {
      this.send({
        type: 'ACK',
        eventId: event.id,
        clientTimestamp: new Date().toISOString()
      });
    }

    // Dispatch to registered entity listeners
    const cleanEntity = (event.entity || '').toLowerCase();
    const handlers = this.listeners.get(cleanEntity);
    if (handlers) {
      handlers.forEach(callback => {
        try {
          callback(event);
        } catch (e) {
          console.error(`[RealTimeWS] Error in listener for ${cleanEntity}:`, e);
        }
      });
    }

    // Wildcard listeners
    const wildcard = this.listeners.get('*');
    if (wildcard) {
      wildcard.forEach(callback => {
        try {
          callback(event);
        } catch (e) {
          console.error('[RealTimeWS] Error in wildcard listener:', e);
        }
      });
    }
  }

  /**
   * Subscribe to real-time events for an entity
   * Returns an unsubscribe function.
   */
  subscribe(entity, callback) {
    const key = (entity || '*').toLowerCase();
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);

    // If socket is open, notify server of subscription
    if (this.ws && this.ws.readyState === WebSocket.OPEN && key !== '*') {
      this.send({ type: 'SUBSCRIBE', entities: [key] });
    }

    return () => {
      const set = this.listeners.get(key);
      if (set) {
        set.delete(callback);
        if (set.size === 0) {
          this.listeners.delete(key);
        }
      }
    };
  }

  /**
   * Observe connection status changes
   */
  onStatusChange(callback) {
    this.statusListeners.add(callback);
    callback(this.status);
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  setStatus(newStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.statusListeners.forEach(cb => {
        try {
          cb(newStatus);
        } catch (e) {}
      });
    }
  }

  getStatus() {
    return this.status;
  }
}

// Global singleton instance
export const realtimeClient = new RealtimeWebSocketClient();
