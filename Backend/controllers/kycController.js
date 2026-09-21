const { db, filterByLocation } = require('../config/db');

async function getKYCRecords(req, res) {
  try {
    // Ensure all managers waiting for KYC verification have an entry in db.kycRecords
    if (db.kycRecords && db.users) {
      const pendingManagers = db.users.filter(u => 
        (u.status === 'pending_kyc' || (u.adminApprovalStatus === 'approved' && u.kycStatus === 'pending_verification')) &&
        (u.role && u.role.includes('manager'))
      );

      for (const mgr of pendingManagers) {
        const mgrIdStr = String(mgr._id || mgr.id);
        const existing = db.kycRecords.find(k => String(k.managerId) === mgrIdStr || k.id === `KYC-MGR-${mgrIdStr}`);
        if (!existing) {
          db.kycRecords.unshift({
            id: `KYC-MGR-${mgrIdStr}`,
            type: 'Manager',
            managerId: mgrIdStr,
            name: mgr.name,
            vendorName: mgr.name,
            category: 'Operations Management',
            role: mgr.role,
            phone: mgr.mobile || mgr.phone,
            email: mgr.email,
            state: mgr.state,
            district: mgr.district,
            division: mgr.division,
            pincode: mgr.pincode,
            stateId: mgr.stateId,
            districtId: mgr.districtId,
            divisionId: mgr.divisionId,
            pincodeId: mgr.pincodeId,
            status: 'Pending',
            kycStatus: 'Pending Verification',
            submittedDate: (mgr.createdAt || new Date().toISOString()).split('T')[0],
            documents: mgr.documents || {},
            notes: `Manager registration approved by ${mgr.targetAdminRole || mgr.createdByRole || 'Admin'}. Forwarded to KYC Team.`
          });
        }
      }
    }

    let scoped = filterByLocation(db.kycRecords, req.user);
    const { status, type, search } = req.query;

    if (status) {
      scoped = scoped.filter(k => (k.status || '').toLowerCase() === status.toLowerCase());
    }
    if (type) {
      scoped = scoped.filter(k => (k.type || '').toLowerCase() === type.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      scoped = scoped.filter(k =>
        (k.businessName || '').toLowerCase().includes(q) ||
        (k.vendorName || '').toLowerCase().includes(q) ||
        (k.name || '').toLowerCase().includes(q) ||
        (k.category || '').toLowerCase().includes(q) ||
        (k.address || '').toLowerCase().includes(q) ||
        (k.verifiedBy || '').toLowerCase().includes(q) ||
        (k.pincode || '').includes(q)
      );
    }

    return res.json({ success: true, count: scoped.length, records: scoped, kyc: scoped });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch KYC records', error: error.message });
  }
}

async function processKYC(req, res) {
  try {
    const { id } = req.params;
    const { status, reason } = req.body; // status: 'Verified' | 'Rejected'

    const record = db.kycRecords.find(k => k.id === id);
    if (!record) return res.status(404).json({ success: false, message: 'KYC record not found' });

    const scoped = filterByLocation([record], req.user);
    if (scoped.length === 0) {
      return res.status(403).json({ success: false, message: 'Record outside your jurisdiction' });
    }

    record.status = status;
    record.verifiedBy = `${req.user.name} (${req.user.role})`;
    record.verifiedDate = new Date().toISOString().split('T')[0];
    if (reason) record.notes = reason;

    // If this KYC record belongs to a manager, activate their account upon verification
    if (record.type === 'Manager' || record.managerId) {
      const mgrId = record.managerId || (record.id && record.id.replace('KYC-MGR-', ''));
      const manager = db.users.find(u => String(u._id || u.id) === String(mgrId));
      if (manager) {
        const now = new Date().toISOString();
        if (status === 'Verified' || status === 'Approved') {
          manager.status = 'active';
          manager.kycStatus = 'Verified';
          manager.kycVerifiedAt = now;
          manager.kycVerifiedBy = `${req.user.name} (${req.user.role})`;
          manager.kycVerifiedById = req.user.id || req.user._id;
          manager.rejectionReason = null;
          manager.updatedAt = now;
          await db.users.update(manager);

          if (db.auditLogs) {
            await db.auditLogs.insertOne({
              action: 'MANAGER_KYC_VERIFIED',
              adminId: req.user.id || req.user._id,
              adminName: req.user.name,
              adminRole: req.user.role,
              targetUserId: manager._id || manager.id,
              targetUserName: manager.name,
              targetUserRole: manager.role,
              details: `KYC verification approved for ${manager.role.replace('_', ' ')} "${manager.name}". Manager account activated and login enabled.`,
              ip: req.ip || '127.0.0.1',
              timestamp: now
            });
          }
        } else if (status === 'Rejected') {
          manager.status = 'rejected';
          manager.kycStatus = 'Rejected';
          manager.rejectionReason = reason || 'KYC documents verification rejected by KYC Team.';
          manager.kycRejectedAt = now;
          manager.kycRejectedBy = `${req.user.name} (${req.user.role})`;
          manager.updatedAt = now;
          await db.users.update(manager);

          if (db.auditLogs) {
            await db.auditLogs.insertOne({
              action: 'MANAGER_KYC_REJECTED',
              adminId: req.user.id || req.user._id,
              adminName: req.user.name,
              adminRole: req.user.role,
              targetUserId: manager._id || manager.id,
              targetUserName: manager.name,
              targetUserRole: manager.role,
              details: `KYC verification rejected for ${manager.role.replace('_', ' ')} "${manager.name}". Reason: ${reason || 'Documents rejected'}`,
              ip: req.ip || '127.0.0.1',
              timestamp: now
            });
          }
        }
      }
    }

    return res.json({ success: true, message: `KYC marked as ${status}`, record });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update KYC status', error: error.message });
  }
}

module.exports = {
  getKYCRecords,
  processKYC
};
