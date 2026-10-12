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
          await db.kycRecords.insertOne({
            _id: `KYC-MGR-${mgrIdStr}`,
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
            notes: `Manager registration approved by ${mgr.targetAdminRole || mgr.createdByRole || 'Admin'}. Forwarded to KYC Team.`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      }
    }

    // Ensure all agents waiting for KYC verification have an entry in db.kycRecords
    if (db.kycRecords && db.agents) {
      const pendingAgents = Array.from(db.agents || []).filter(a =>
        a.status === 'pending_kyc' || (a.adminApprovalStatus === 'approved' && (a.kycStatus === 'pending_verification' || a.kycStatus === 'pending'))
      );

      for (const ag of pendingAgents) {
        const agIdStr = String(ag._id || ag.id);
        const existing = db.kycRecords.find(k => String(k.agentId) === agIdStr || k.id === `KYC-AGT-${agIdStr}`);
        if (!existing) {
          const terr = (ag.territory || {});
          await db.kycRecords.insertOne({
            _id: `KYC-AGT-${agIdStr}`,
            id: `KYC-AGT-${agIdStr}`,
            type: 'Agent',
            agentId: agIdStr,
            name: ag.name,
            vendorName: ag.name,
            category: 'Field Agency Network',
            role: ag.role || `${ag.level || 'Pincode'} Agent`,
            phone: ag.phone || ag.mobile,
            email: ag.email,
            state: ag.state || terr.state,
            district: ag.district || terr.district,
            division: ag.division || terr.division,
            pincode: ag.pincode || terr.pincode,
            status: 'Pending',
            kycStatus: 'Pending Verification',
            submittedDate: (ag.createdAt || new Date().toISOString()).split('T')[0],
            documents: ag.documents || ag.kycDocs || {},
            notes: `Agent registration territory-approved by administrative review. Forwarded to KYC Team.`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
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
    const { status, reason } = req.body; // status: 'Verified' | 'Approved' | 'Rejected' | 'Pending'

    const record = (await db.kycRecords.findById(id)) || Array.from(db.kycRecords || []).find(k => String(k._id || k.id) === String(id));
    if (!record) return res.status(404).json({ success: false, message: 'KYC record not found' });

    const scoped = filterByLocation([record], req.user);
    if (scoped.length === 0) {
      return res.status(403).json({ success: false, message: 'Record outside your jurisdiction' });
    }

    const normStatus = (status || '').toLowerCase();
    const isApprovedAction = normStatus === 'verified' || normStatus === 'approved' || normStatus === 'kyc approved';
    const isRejectedAction = normStatus === 'rejected';
    const isPendingAction = normStatus === 'pending';

    const trimmedReason = (reason || '').trim();
    if (isRejectedAction && !trimmedReason) {
      return res.status(400).json({ success: false, message: 'A rejection reason is strictly required.' });
    }
    if (isPendingAction && !trimmedReason) {
      return res.status(400).json({ success: false, message: 'A reason or note explaining why KYC is pending is strictly required.' });
    }

    const verifiedDate = new Date().toISOString().split('T')[0];
    const verifiedBy = `${req.user.name} (${req.user.role})`;
    const now = new Date().toISOString();

    const canonicalStatus = isApprovedAction ? 'Verified' : isRejectedAction ? 'Rejected' : 'Pending';

    const kycUpdates = {
      status: canonicalStatus,
      kycStatus: canonicalStatus,
      verifiedBy,
      verifiedDate,
      notes: trimmedReason || record.notes || '',
      reason: trimmedReason || record.reason || '',
      rejectionReason: isRejectedAction ? trimmedReason : record.rejectionReason,
      pendingReason: isPendingAction ? trimmedReason : record.pendingReason,
      updatedAt: now
    };

    const updatedKyc = await db.kycRecords.findByIdAndUpdate(record._id || record.id, kycUpdates);

    // If this KYC record belongs to a manager
    if (record.type === 'Manager' || record.managerId) {
      const mgrId = record.managerId || (record.id && record.id.replace('KYC-MGR-', ''));
      const manager = (await db.users.findById(mgrId)) || Array.from(db.users || []).find(u => String(u._id || u.id) === String(mgrId));
      if (manager) {
        const mgrRoleLabel = (manager.role || 'manager').replace(/_/g, ' ');
        if (isApprovedAction) {
          // STRICT RULE: Only activate account if Sub-Admin previously approved it
          const priorAdminApproved = manager.adminApprovalStatus === 'approved';
          manager.kycStatus = 'Verified';
          manager.kycVerifiedAt = now;
          manager.kycVerifiedBy = verifiedBy;
          manager.kycVerifiedById = req.user.id || req.user._id;
          manager.rejectionReason = null;
          manager.pendingReason = null;
          manager.kycRejectionReason = null;
          manager.kycPendingReason = null;
          manager.updatedAt = now;

          if (priorAdminApproved) {
            manager.status = 'active';
            manager.isActive = true;
          } else {
            // Keep status pending administrative approval
            manager.isActive = false;
          }
          await db.users.update(manager);

          if (db.auditLogs) {
            await db.auditLogs.insertOne({
              action: priorAdminApproved ? 'MANAGER_KYC_VERIFIED_ACTIVATED' : 'MANAGER_KYC_VERIFIED_AWAITING_ADMIN',
              adminId: req.user.id || req.user._id,
              adminName: req.user.name,
              adminRole: req.user.role,
              targetUserId: manager._id || manager.id,
              targetUserName: manager.name,
              targetUserRole: manager.role,
              details: priorAdminApproved 
                ? `KYC verification approved for ${mgrRoleLabel} "${manager.name}". Manager account activated and login enabled.`
                : `KYC verification approved for ${mgrRoleLabel} "${manager.name}". Account remains inactive pending Sub-Admin territory approval.`,
              ip: req.ip || '127.0.0.1',
              timestamp: now
            });
          }
        } else if (isRejectedAction) {
          manager.status = 'rejected';
          manager.kycStatus = 'Rejected';
          manager.isActive = false;
          manager.rejectionReason = trimmedReason;
          manager.kycRejectionReason = trimmedReason;
          manager.kycRejectedAt = now;
          manager.kycRejectedBy = verifiedBy;
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
              details: `KYC verification rejected for ${mgrRoleLabel} "${manager.name}". Reason: ${trimmedReason}`,
              ip: req.ip || '127.0.0.1',
              timestamp: now
            });
          }
        } else if (isPendingAction) {
          manager.status = 'pending';
          manager.kycStatus = 'pending';
          manager.isActive = false;
          manager.pendingReason = trimmedReason;
          manager.kycPendingReason = trimmedReason;
          manager.kycPendingAt = now;
          manager.kycPendingBy = verifiedBy;
          manager.updatedAt = now;
          await db.users.update(manager);

          if (db.auditLogs) {
            await db.auditLogs.insertOne({
              action: 'MANAGER_KYC_KEPT_PENDING',
              adminId: req.user.id || req.user._id,
              adminName: req.user.name,
              adminRole: req.user.role,
              targetUserId: manager._id || manager.id,
              targetUserName: manager.name,
              targetUserRole: manager.role,
              details: `KYC verification kept pending for ${mgrRoleLabel} "${manager.name}". Reason: ${trimmedReason}`,
              ip: req.ip || '127.0.0.1',
              timestamp: now
            });
          }
        }
      }
    }

    // If this KYC record belongs to an agent, synchronize agent document in db.agents and db.users
    if (record.type === 'Agent' || record.agentId) {
      const agId = record.agentId || (record.id && record.id.replace('KYC-AGT-', ''));
      const agent = Array.from(db.agents || []).find(a => String(a._id || a.id) === String(agId));
      const user = (db.users || []).find(u => String(u._id || u.id) === String(agId) || (agent && u.email && u.email.toLowerCase() === agent.email.toLowerCase()));

      if (agent) {
        if (isApprovedAction) {
          // STRICT RULE: Only activate account if Sub-Admin previously approved it
          const priorAdminApproved = agent.adminApprovalStatus === 'approved';
          const updates = {
            kycStatus: 'Verified',
            kycVerifiedAt: now,
            kycVerifiedBy: verifiedBy,
            rejectionReason: null,
            pendingReason: null,
            kycRejectionReason: null,
            kycPendingReason: null,
            status: priorAdminApproved ? 'approved' : agent.status || 'pending_admin_approval',
            isActive: priorAdminApproved,
            isApproved: priorAdminApproved,
            updatedAt: now
          };
          Object.assign(agent, updates);
          await db.agents.findByIdAndUpdate(agId, updates);

          if (user) {
            user.kycStatus = 'Verified';
            user.kycVerifiedAt = now;
            user.kycVerifiedBy = verifiedBy;
            user.rejectionReason = null;
            user.pendingReason = null;
            user.kycRejectionReason = null;
            user.kycPendingReason = null;
            if (priorAdminApproved) {
              user.status = 'active';
              user.isActive = true;
            } else {
              user.isActive = false;
            }
            user.updatedAt = now;
            await db.users.update(user);
          }

          if (db.auditLogs) {
            await db.auditLogs.insertOne({
              action: priorAdminApproved ? 'AGENT_KYC_VERIFIED_ACTIVATED' : 'AGENT_KYC_VERIFIED_AWAITING_ADMIN',
              adminId: req.user.id || req.user._id,
              adminName: req.user.name,
              adminRole: req.user.role,
              targetUserId: agId,
              targetUserName: agent.name,
              details: priorAdminApproved
                ? `Agent "${agent.name}" (${agent.role || agent.level}) KYC verification approved and account activated.`
                : `Agent "${agent.name}" (${agent.role || agent.level}) KYC verified, awaiting Sub-Admin territory approval before activation.`,
              ip: req.ip || '127.0.0.1',
              timestamp: now
            });
          }
        } else if (isRejectedAction) {
          const updates = {
            status: 'rejected',
            kycStatus: 'Rejected',
            isActive: false,
            isApproved: false,
            rejectionReason: trimmedReason,
            kycRejectionReason: trimmedReason,
            kycRejectedAt: now,
            kycRejectedBy: verifiedBy,
            updatedAt: now
          };
          Object.assign(agent, updates);
          await db.agents.findByIdAndUpdate(agId, updates);

          if (user) {
            user.status = 'rejected';
            user.kycStatus = 'Rejected';
            user.isActive = false;
            user.rejectionReason = trimmedReason;
            user.kycRejectionReason = trimmedReason;
            user.updatedAt = now;
            await db.users.update(user);
          }

          if (db.auditLogs) {
            await db.auditLogs.insertOne({
              action: 'AGENT_KYC_REJECTED',
              adminId: req.user.id || req.user._id,
              adminName: req.user.name,
              adminRole: req.user.role,
              targetUserId: agId,
              targetUserName: agent.name,
              details: `Agent "${agent.name}" KYC verification rejected. Reason: ${trimmedReason}`,
              ip: req.ip || '127.0.0.1',
              timestamp: now
            });
          }
        } else if (isPendingAction) {
          const updates = {
            status: 'pending',
            kycStatus: 'pending',
            isActive: false,
            isApproved: false,
            pendingReason: trimmedReason,
            kycPendingReason: trimmedReason,
            kycPendingAt: now,
            kycPendingBy: verifiedBy,
            updatedAt: now
          };
          Object.assign(agent, updates);
          await db.agents.findByIdAndUpdate(agId, updates);

          if (user) {
            user.status = 'pending';
            user.kycStatus = 'pending';
            user.isActive = false;
            user.pendingReason = trimmedReason;
            user.kycPendingReason = trimmedReason;
            user.updatedAt = now;
            await db.users.update(user);
          }

          if (db.auditLogs) {
            await db.auditLogs.insertOne({
              action: 'AGENT_KYC_KEPT_PENDING',
              adminId: req.user.id || req.user._id,
              adminName: req.user.name,
              adminRole: req.user.role,
              targetUserId: agId,
              targetUserName: agent.name,
              details: `Agent "${agent.name}" KYC verification kept pending. Reason: ${trimmedReason}`,
              ip: req.ip || '127.0.0.1',
              timestamp: now
            });
          }
        }
      }
    }

    // If this KYC record belongs to a vendor, synchronize vendor document in db.vendors
    if (record.type === 'Vendor' || record.vendorId) {
      const vId = record.vendorId || (record.id && record.id.replace('KYC-', ''));
      const vendor = await db.vendors.findById(vId) || db.vendors.find(v => String(v._id || v.id) === String(vId));
      if (vendor) {
        const isApproved = isApprovedAction;
        const updates = isApproved ? {
          kycStatus: 'Verified',
          approvalStatus: 'Approved',
          status: 'Active',
          kycVerifiedAt: now,
          kycVerifiedBy: verifiedBy
        } : isRejectedAction ? {
          kycStatus: 'Rejected',
          approvalStatus: 'Rejected',
          rejectionReason: trimmedReason || 'KYC documents verification rejected.',
          kycRejectedAt: now,
          kycRejectedBy: verifiedBy
        } : {
          kycStatus: 'Pending',
          approvalStatus: 'Pending',
          pendingReason: trimmedReason || 'KYC documents pending additional review.',
          kycPendingAt: now,
          kycPendingBy: verifiedBy
        };
        await db.vendors.findByIdAndUpdate(vId, updates);

        if (db.auditLogs) {
          await db.auditLogs.insertOne({
            action: isApproved ? 'VENDOR_KYC_VERIFIED' : isRejectedAction ? 'VENDOR_KYC_REJECTED' : 'VENDOR_KYC_KEPT_PENDING',
            adminId: req.user.id || req.user._id,
            adminName: req.user.name,
            adminRole: req.user.role,
            targetVendorId: vId,
            details: `KYC verification marked as ${canonicalStatus} for vendor ${vendor.businessName || vendor.name}.`,
            ip: req.ip || '127.0.0.1',
            timestamp: now
          });
        }
      }
    }

    return res.json({ success: true, message: `KYC marked as ${canonicalStatus}`, record: { ...record, ...kycUpdates } });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update KYC status', error: error.message });
  }
}

module.exports = {
  getKYCRecords,
  processKYC
};
