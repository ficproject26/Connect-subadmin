/**
 * Centralized Event Naming & Payload Standards
 * Enforces uniform, structured event formatting across all entities in the ecosystem.
 */

const { v4: uuidv4 } = require('uuid');
const os = require('os');

const SYSTEM_EVENTS_CHANNEL = 'SYSTEM_REALTIME_EVENTS';
const INSTANCE_ID = `backend_${os.hostname()}_${process.pid}_${Math.random().toString(36).substring(2, 7)}`;

const EventActions = {
  CREATED: 'created',
  UPDATED: 'updated',
  DELETED: 'deleted',
  BATCH_CREATED: 'batch_created',
  BATCH_UPDATED: 'batch_updated',
  STATUS_CHANGED: 'status_changed',
  ACTION_PERFORMED: 'action_performed'
};

/**
 * Extracts geographic & authorization scope from arbitrary entity records
 */
function extractEntityScope(data = {}) {
  return {
    state: data.state || data.stateName || null,
    district: data.district || data.districtName || null,
    division: data.division || data.divisionName || null,
    pincode: data.pincode || data.pincodeCode || data.code || null,
    stateId: data.stateId || null,
    districtId: data.districtId || null,
    divisionId: data.divisionId || null,
    pincodeId: data.pincodeId || null,
    targetUserId: data.targetUserId || data.userId || data.assignedManagerId || data.managerId || null,
    targetRoles: Array.isArray(data.targetRoles) ? data.targetRoles : []
  };
}

/**
 * Strips internal/sensitive fields before broadcasting over WebSocket
 */
function sanitizeEventData(data) {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitizeEventData);

  const clean = { ...data };
  delete clean.password;
  delete clean.passwordHash;
  delete clean.salt;
  delete clean.__v;
  return clean;
}

/**
 * Creates a standardized real-time event object
 */
function createEvent({
  entity,
  action,
  data = {},
  entityId = null,
  customScope = null,
  version = null
}) {
  const cleanEntity = (entity || 'generic').toLowerCase();
  const cleanAction = (action || EventActions.UPDATED).toLowerCase();
  const resolvedId = entityId || data._id || data.id || uuidv4();
  const scope = customScope || extractEntityScope(data);

  return {
    id: `evt_${uuidv4()}`,
    event: `${cleanEntity.toUpperCase()}_${cleanAction.toUpperCase()}`,
    entity: cleanEntity,
    entityId: String(resolvedId),
    action: cleanAction,
    timestamp: new Date().toISOString(),
    version: version || Date.now(),
    data: sanitizeEventData(data),
    scope,
    sourceInstanceId: INSTANCE_ID
  };
}

module.exports = {
  SYSTEM_EVENTS_CHANNEL,
  INSTANCE_ID,
  EventActions,
  extractEntityScope,
  sanitizeEventData,
  createEvent
};
