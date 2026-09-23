const { db } = require('../config/db');

// In-memory active SSE clients: Map<clientId, { res, user, connectedAt }>
const clients = new Map();

// Periodic heartbeat to keep SSE connections open through firewalls & proxies
setInterval(() => {
  for (const [clientId, client] of clients.entries()) {
    try {
      client.res.write(': keep-alive\n\n');
    } catch (err) {
      clients.delete(clientId);
    }
  }
}, 25000);

/**
 * Register an SSE client connection
 */
function registerClient(clientId, res, user) {
  clients.set(clientId, { res, user, connectedAt: new Date() });
  
  // Send immediate initial ping
  try {
    res.write(`data: ${JSON.stringify({ type: 'connected', clientId, timestamp: new Date().toISOString() })}\n\n`);
  } catch (err) {
    clients.delete(clientId);
  }
}

/**
 * Unregister an SSE client connection
 */
function unregisterClient(clientId) {
  clients.delete(clientId);
}

/**
 * Determine if a notification matches a user's role and geographic scope
 */
function isNotificationInScope(notification, user) {
  if (!user) return true;
  const role = (user.role || '').toLowerCase();
  const nScope = notification.scope || {};

  // If targeted directly to this specific user ID
  const userId = String(user.id || user._id || '');
  if (nScope.targetUserId && String(nScope.targetUserId) === userId) {
    return true;
  }

  // Super Admin / All India State Admin sees all notifications
  if (role.includes('super admin') || role === 'admin' || (role.includes('state') && (!user.state || user.state === 'All India'))) {
    return true;
  }

  // State Admin: matches if notification is in same state or statewide
  if (role.includes('state') && !role.includes('district') && !role.includes('division') && !role.includes('pincode') && !role.includes('manager')) {
    if (!nScope.state || !user.state) return true;
    return nScope.state.toLowerCase() === user.state.toLowerCase();
  }

  // District Admin: matches if in same district
  if (role.includes('district') && !role.includes('manager')) {
    if (!nScope.district || !user.district) return true;
    return nScope.district.toLowerCase() === user.district.toLowerCase();
  }

  // Division Admin: matches if in same division
  if ((role.includes('division') || role.includes('divisional')) && !role.includes('manager')) {
    if (!nScope.division || !user.division) return true;
    return nScope.division.toLowerCase() === user.division.toLowerCase();
  }

  // Pincode Admin: matches if in same pincode
  if (role.includes('pincode') && !role.includes('manager')) {
    if (!nScope.pincode || !user.pincode) return true;
    return String(nScope.pincode) === String(user.pincode);
  }

  // Field Managers
  if (role.includes('manager')) {
    // If targeted role includes managers
    if (nScope.targetRoles && nScope.targetRoles.some(r => r.toLowerCase().includes('manager'))) {
      if (nScope.pincode && user.pincode && String(nScope.pincode) === String(user.pincode)) return true;
      if (nScope.division && user.division && nScope.division.toLowerCase() === user.division.toLowerCase()) return true;
      if (nScope.district && user.district && nScope.district.toLowerCase() === user.district.toLowerCase()) return true;
      if (!nScope.pincode && !nScope.district && !nScope.division) return true;
    }
    // Also if manager is creator or assignee
    if (notification.metadata?.managerId && String(notification.metadata.managerId) === userId) {
      return true;
    }
    if (notification.metadata?.assignedManagerId && String(notification.metadata.assignedManagerId) === userId) {
      return true;
    }
  }

  // Default fallback: allow if no strict geographic bounds
  if (!nScope.pincode && !nScope.division && !nScope.district && !nScope.state) {
    return true;
  }

  return false;
}

/**
 * Persist and broadcast a notification
 */
async function createAndBroadcast(payload) {
  const notificationId = `NOTIF-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  const notification = {
    _id: notificationId,
    id: notificationId,
    title: payload.title,
    message: payload.message || payload.desc || '',
    type: payload.type || 'system', // 'vendor_onboarding', 'vendor_status', 'task_created', 'task_update', 'qc_issue'
    category: payload.category || 'general',
    entityId: payload.entityId || null,
    entityType: payload.entityType || null, // 'vendor', 'task', 'qc_issue'
    actionUrl: payload.actionUrl || null,
    scope: payload.scope || {},
    metadata: payload.metadata || {},
    priority: payload.priority || 'normal', // 'normal', 'high', 'urgent'
    readBy: [],
    isRead: false,
    createdAt: new Date().toISOString()
  };

  // Persist to collection
  if (db.notifications) {
    await db.notifications.insertOne(notification);
  }

  // Broadcast to all connected clients that are in scope
  for (const [clientId, client] of clients.entries()) {
    try {
      if (isNotificationInScope(notification, client.user)) {
        client.res.write(`data: ${JSON.stringify({
          type: 'notification',
          data: {
            ...notification,
            isRead: false
          }
        })}\n\n`);
      }
    } catch (err) {
      clients.delete(clientId);
    }
  }

  return notification;
}

/**
 * Fetch scoped notifications for a user
 */
function getNotificationsForUser(user, options = {}) {
  const { type, unreadOnly, search, limit = 50, page = 1 } = options;
  const allNotifications = Array.from(db.notifications || []);
  const userId = String(user?.id || user?._id || '');

  // Filter by user jurisdiction and target scope
  let filtered = allNotifications.filter(n => isNotificationInScope(n, user));

  // Filter by type if requested
  if (type && type !== 'all') {
    if (type === 'vendors' || type === 'vendor') {
      filtered = filtered.filter(n => n.type.startsWith('vendor') || n.entityType === 'vendor');
    } else if (type === 'tasks' || type === 'task') {
      filtered = filtered.filter(n => n.type.startsWith('task') || n.type.startsWith('qc') || n.entityType === 'task');
    } else {
      filtered = filtered.filter(n => n.type === type);
    }
  }

  // Filter by search text
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(n =>
      (n.title && n.title.toLowerCase().includes(q)) ||
      (n.message && n.message.toLowerCase().includes(q))
    );
  }

  // Decorate with user-specific read status
  const decorated = filtered.map(n => ({
    ...n,
    isRead: (n.readBy && n.readBy.includes(userId)) || (n.readBy && n.readBy.length > 0 && !userId) || !!n.isRead
  }));

  const unreadCount = decorated.filter(n => !n.isRead).length;

  // Filter unreadOnly if requested
  let resultList = decorated;
  if (unreadOnly === 'true' || unreadOnly === true) {
    resultList = resultList.filter(n => !n.isRead);
  }

  // Sort descending by creation date
  resultList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Pagination
  const total = resultList.length;
  const startIndex = (page - 1) * limit;
  const paginated = resultList.slice(startIndex, startIndex + limit);

  return {
    notifications: paginated,
    unreadCount,
    total,
    page,
    limit
  };
}

/**
 * Mark a single notification as read
 */
async function markNotificationAsRead(id, userId) {
  const notif = (db.notifications || []).find(n => n._id === id || n.id === id);
  if (!notif) return null;

  notif.readBy = notif.readBy || [];
  if (userId && !notif.readBy.includes(String(userId))) {
    notif.readBy.push(String(userId));
  }
  notif.isRead = true;
  await db.notifications.findByIdAndUpdate(notif._id, { readBy: notif.readBy, isRead: true });
  return notif;
}

/**
 * Mark all scoped notifications as read for a user
 */
async function markAllNotificationsAsRead(user) {
  const userId = String(user?.id || user?._id || '');
  const allNotifications = Array.from(db.notifications || []);
  let count = 0;

  for (const notif of allNotifications) {
    if (isNotificationInScope(notif, user)) {
      notif.readBy = notif.readBy || [];
      if (userId && !notif.readBy.includes(userId)) {
        notif.readBy.push(userId);
      }
      notif.isRead = true;
      await db.notifications.findByIdAndUpdate(notif._id, { readBy: notif.readBy, isRead: true });
      count++;
    }
  }

  return { updatedCount: count };
}

/**
 * Delete / dismiss a notification
 */
async function deleteNotification(id) {
  if (db.notifications) {
    return await db.notifications.deleteOne({ _id: id });
  }
  return { deletedCount: 0 };
}

// ─── HIGH-LEVEL EVENT DISPATCHERS ─────────────────────────────────────────────

/**
 * 1. Vendor Onboarded Trigger
 */
async function notifyVendorOnboarding({ vendor, creator }) {
  const vendorName = vendor.businessName || vendor.name;
  const pincode = vendor.pincode || vendor.pincodeCode || '';
  const district = vendor.district || '';
  const division = vendor.division || '';
  const state = vendor.state || 'Tamil Nadu';

  return await createAndBroadcast({
    title: `New Vendor Onboarded: ${vendorName}`,
    message: `${vendor.category || 'Retail'} merchant '${vendorName}' was onboarded in PIN ${pincode || 'Local'} (${district || 'District'}) by ${creator?.name || 'Field Manager'}. Awaiting Pincode Admin clearance.`,
    type: 'vendor_onboarding',
    category: 'vendor',
    entityId: vendor._id || vendor.id,
    entityType: 'vendor',
    actionUrl: `/state-admin/vendors`,
    priority: 'normal',
    scope: {
      state,
      district,
      division,
      pincode,
      targetRoles: ['State Admin', 'District Admin', 'Division Admin', 'Pincode Admin', 'Manager']
    },
    metadata: {
      vendorId: vendor._id || vendor.id,
      vendorName,
      creatorId: creator?.id || creator?._id,
      creatorName: creator?.name,
      pincode,
      category: vendor.category
    }
  });
}

/**
 * 2. Vendor Status Change Trigger
 */
async function notifyVendorStatusChange({ vendor, oldStatus, newStatus, user, notes }) {
  const vendorName = vendor.businessName || vendor.name;
  const isApproval = newStatus === 'Active' || newStatus === 'Approved';
  const isRejection = newStatus === 'Rejected' || newStatus === 'Suspended';

  return await createAndBroadcast({
    title: `Vendor Status: ${vendorName} is now ${newStatus}`,
    message: `Status updated from '${oldStatus || 'Under Review'}' to '${newStatus}' by ${user?.name || 'Administrator'}.${notes ? ` Notes: ${notes}` : ''}`,
    type: 'vendor_status',
    category: 'vendor',
    entityId: vendor._id || vendor.id,
    entityType: 'vendor',
    actionUrl: `/state-admin/vendors`,
    priority: isRejection ? 'high' : (isApproval ? 'normal' : 'normal'),
    scope: {
      state: vendor.state,
      district: vendor.district,
      division: vendor.division,
      pincode: vendor.pincode,
      targetUserId: vendor.createdBy || vendor.addedBy?.id,
      targetRoles: ['State Admin', 'District Admin', 'Division Admin', 'Pincode Admin', 'Manager']
    },
    metadata: {
      vendorId: vendor._id || vendor.id,
      vendorName,
      oldStatus,
      newStatus,
      updatedBy: user?.name,
      updatedByRole: user?.role
    }
  });
}

/**
 * 3. Vendor Verification (Pincode Admin Accept / Reject)
 */
async function notifyVendorVerification({ vendor, action, reason, admin }) {
  const vendorName = vendor.businessName || vendor.name;
  const isReject = action.toLowerCase() === 'reject';
  const newStatus = isReject ? 'Rejected' : 'Pending KYC Review';

  return await createAndBroadcast({
    title: isReject ? `Vendor Rejected: ${vendorName}` : `Vendor Approved: ${vendorName}`,
    message: isReject
      ? `Pincode Admin ${admin?.name} rejected merchant '${vendorName}'. Reason: ${reason || 'Incomplete documentation'}.`
      : `Pincode Admin ${admin?.name} approved merchant '${vendorName}'. Sent for central KYC review.`,
    type: 'vendor_status',
    category: 'vendor',
    entityId: vendor._id || vendor.id,
    entityType: 'vendor',
    actionUrl: `/state-admin/vendors`,
    priority: isReject ? 'high' : 'normal',
    scope: {
      state: vendor.state,
      district: vendor.district,
      division: vendor.division,
      pincode: vendor.pincode,
      targetUserId: vendor.createdBy || vendor.addedBy?.id,
      targetRoles: ['State Admin', 'District Admin', 'Division Admin', 'Pincode Admin', 'Manager']
    },
    metadata: {
      vendorId: vendor._id || vendor.id,
      vendorName,
      action,
      reason,
      verifiedBy: admin?.name,
      pincode: vendor.pincode
    }
  });
}

/**
 * 4. Task Created Trigger
 */
async function notifyTaskCreated({ task, manager, admin }) {
  return await createAndBroadcast({
    title: `New Task Assigned: ${task.title}`,
    message: `Task ${task.taskNumber} (${task.priority} Priority) was assigned to ${manager?.name || 'Field Manager'}. Due: ${task.dueDate || 'Flexible'}.`,
    type: 'task_created',
    category: 'task',
    entityId: task._id || task.id,
    entityType: 'task',
    actionUrl: `/manager/tasks`,
    priority: (task.priority || '').toLowerCase() === 'high' ? 'high' : 'normal',
    scope: {
      state: task.state,
      district: task.district,
      division: task.division,
      pincode: task.pincode,
      targetUserId: manager?._id || manager?.id || task.assignedManagerId,
      targetRoles: ['Manager', 'State Admin', 'District Admin', 'Division Admin', 'Pincode Admin']
    },
    metadata: {
      taskId: task._id || task.id,
      taskNumber: task.taskNumber,
      title: task.title,
      assignedManagerId: manager?._id || manager?.id || task.assignedManagerId,
      assignedManagerName: manager?.name,
      createdByName: admin?.name,
      priority: task.priority
    }
  });
}

/**
 * 5. Task Status Changed (Started, Completed, Accepted, Rework)
 */
async function notifyTaskStatus({ task, oldStatus, newStatus, user, notes }) {
  const isUrgent = newStatus === 'Suspend Requested' || newStatus === 'Rework Required';

  return await createAndBroadcast({
    title: `Task Update: ${task.taskNumber} is ${newStatus}`,
    message: `Task '${task.title}' updated to '${newStatus}' by ${user?.name || 'Team member'}.${notes ? ` Note: ${notes}` : ''}`,
    type: 'task_update',
    category: 'task',
    entityId: task._id || task.id,
    entityType: 'task',
    actionUrl: `/state-admin/tasks`,
    priority: isUrgent ? 'high' : 'normal',
    scope: {
      state: task.state,
      district: task.district,
      division: task.division,
      pincode: task.pincode,
      targetUserId: task.assignedManagerId,
      targetRoles: ['State Admin', 'District Admin', 'Division Admin', 'Pincode Admin', 'Manager']
    },
    metadata: {
      taskId: task._id || task.id,
      taskNumber: task.taskNumber,
      title: task.title,
      oldStatus,
      newStatus,
      updatedBy: user?.name
    }
  });
}

/**
 * 6. Task Suspension Request
 */
async function notifyTaskSuspensionRequest({ task, reason, user }) {
  return await createAndBroadcast({
    title: `Task Suspension Requested: ${task.taskNumber}`,
    message: `Manager ${user?.name} submitted a hold/suspension request for '${task.title}'. Reason: ${reason}`,
    type: 'task_update',
    category: 'task',
    entityId: task._id || task.id,
    entityType: 'task',
    actionUrl: `/state-admin/tasks`,
    priority: 'high',
    scope: {
      state: task.state,
      district: task.district,
      division: task.division,
      pincode: task.pincode,
      targetRoles: ['State Admin', 'District Admin', 'Division Admin', 'Pincode Admin']
    },
    metadata: {
      taskId: task._id || task.id,
      taskNumber: task.taskNumber,
      requestedBy: user?.name,
      reason
    }
  });
}

/**
 * 7. Task Suspension Decision (Approved / Rejected)
 */
async function notifyTaskSuspensionDecision({ task, decision, admin }) {
  const isApprove = decision === 'approve';
  return await createAndBroadcast({
    title: `Suspension ${isApprove ? 'Approved' : 'Rejected'}: ${task.taskNumber}`,
    message: `Admin ${admin?.name} ${isApprove ? 'approved' : 'rejected'} suspension for '${task.title}'. Status is now '${task.status}'.`,
    type: 'task_update',
    category: 'task',
    entityId: task._id || task.id,
    entityType: 'task',
    priority: isApprove ? 'normal' : 'high',
    scope: {
      state: task.state,
      district: task.district,
      division: task.division,
      pincode: task.pincode,
      targetUserId: task.assignedManagerId,
      targetRoles: ['Manager', 'State Admin', 'District Admin']
    },
    metadata: {
      taskId: task._id || task.id,
      taskNumber: task.taskNumber,
      decision,
      decidedBy: admin?.name
    }
  });
}

/**
 * 8. Task Review (Accepted / Sent for Rework)
 */
async function notifyTaskReview({ task, decision, reworkReason, admin }) {
  const isAccept = decision === 'accept';
  return await createAndBroadcast({
    title: isAccept ? `Task Verified & Closed: ${task.taskNumber}` : `Rework Requested: ${task.taskNumber}`,
    message: isAccept
      ? `Admin ${admin?.name} inspected and accepted completion for '${task.title}'.`
      : `Admin ${admin?.name} requested rework for '${task.title}'. Remarks: ${reworkReason || 'Needs correction'}.`,
    type: 'task_update',
    category: 'task',
    entityId: task._id || task.id,
    entityType: 'task',
    actionUrl: `/manager/tasks`,
    priority: isAccept ? 'normal' : 'high',
    scope: {
      state: task.state,
      district: task.district,
      division: task.division,
      pincode: task.pincode,
      targetUserId: task.assignedManagerId,
      targetRoles: ['Manager', 'State Admin', 'District Admin', 'Division Admin', 'Pincode Admin']
    },
    metadata: {
      taskId: task._id || task.id,
      taskNumber: task.taskNumber,
      decision,
      reworkReason,
      reviewedBy: admin?.name
    }
  });
}

/**
 * 9. QC Issue Raised
 */
async function notifyQCIssue({ issue, user }) {
  return await createAndBroadcast({
    title: `QC Issue Raised: ${issue.issueNumber}`,
    message: `${issue.issueType} reported at ${issue.location || issue.pincode || 'Jurisdiction'}. Priority: ${issue.priority}.`,
    type: 'qc_issue',
    category: 'qc',
    entityId: issue._id || issue.id,
    entityType: 'qc_issue',
    actionUrl: `/state-admin/tasks`,
    priority: (issue.priority || '').toLowerCase() === 'high' ? 'high' : 'normal',
    scope: {
      state: issue.state,
      district: issue.district,
      division: issue.division,
      pincode: issue.pincode,
      targetRoles: ['State Admin', 'District Admin', 'Division Admin', 'Pincode Admin']
    },
    metadata: {
      issueId: issue._id || issue.id,
      issueNumber: issue.issueNumber,
      issueType: issue.issueType,
      raisedBy: user?.name
    }
  });
}

module.exports = {
  registerClient,
  unregisterClient,
  isNotificationInScope,
  createAndBroadcast,
  getNotificationsForUser,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  notifyVendorOnboarding,
  notifyVendorStatusChange,
  notifyVendorVerification,
  notifyTaskCreated,
  notifyTaskStatus,
  notifyTaskSuspensionRequest,
  notifyTaskSuspensionDecision,
  notifyTaskReview,
  notifyQCIssue
};
