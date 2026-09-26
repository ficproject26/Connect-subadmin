/**
 * Centralized Real-Time Observability & Health Metrics
 */

const { getRedisStatus } = require('../redis/redisClient');
const eventPublisher = require('../events/eventPublisher');
const { getSubscriberMetrics } = require('../events/eventSubscriber');
const { getWebSocketMetrics } = require('../websocket/websocketServer');

function getSystemRealtimeTelemetry() {
  const redis = getRedisStatus();
  const publisher = eventPublisher.getMetrics();
  const subscriber = getSubscriberMetrics();
  const websocket = getWebSocketMetrics();

  return {
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'Unified Real-Time Event & WebSocket Broker',
    targetPropagationLatency: '< 500ms',
    realtime: {
      redis,
      websocket: {
        activeConnections: websocket.activeConnections,
        authenticatedConnections: websocket.authenticatedConnections,
        totalEventsBroadcast: websocket.totalEventsBroadcast,
        averageLatencyMs: websocket.averageClientLatencyMs,
        activeUsersSample: websocket.authenticatedUsers.slice(0, 10)
      },
      events: {
        totalPublished: publisher.totalPublished,
        totalDeduplicated: publisher.totalDeduplicated,
        totalReceivedFromRedis: subscriber.totalReceived,
        totalForwardedToWs: subscriber.totalForwardedToWs,
        lastPublishedAt: publisher.lastPublishedAt,
        eventsByEntity: publisher.eventsByEntity
      }
    }
  };
}

module.exports = {
  getSystemRealtimeTelemetry
};
