const { db, filterByLocation } = require('../config/db');
const { getScopeFilter } = require('../middleware/scopeMiddleware');

function getDashboardSummary(req, res) {
  try {
    const user = req.user;
    const scopedCustomers = filterByLocation(db.customers, user);
    const scopedVendors = filterByLocation(db.vendors, user);
    const scopedOrders = filterByLocation(db.orders, user);
    const scopedBookings = filterByLocation(db.bookings, user);
    const scopedJobs = filterByLocation(db.jobs, user);
    const scopedTechnicians = filterByLocation(db.technicians, user);
    const scopedExecutives = filterByLocation(db.executives, user);
    const scopedSupport = filterByLocation(db.supportTeam, user);
    const scopedAgents = filterByLocation(db.agents, user);
    const scopedKYC = filterByLocation(db.kycRecords, user);
    const scopedAgentPayments = filterByLocation(db.agentPayments, user);
    const scopedVendorPayments = filterByLocation(db.vendorPayments, user);
    const allUsers = Array.from(db.users || []);
    const pinAdmins = allUsers.filter(u => {
      const isPinAdmin = u.role === 'Pincode Admin' || (u.role || '').toLowerCase().includes('pincode admin');
      return isPinAdmin && u.status === 'active';
    });
    const scopedPincodes = filterByLocation(pinAdmins, user);

    const totalRevenue = scopedOrders.reduce((sum, o) => sum + (o.netPayable || o.totalAmount || 0), 0);
    const pendingAgentPayouts = scopedAgentPayments
      .filter(p => p.status === 'Pending')
      .reduce((sum, p) => sum + p.amount, 0);

    const pendingVendorPayouts = scopedVendorPayments
      .filter(p => p.status === 'Pending')
      .reduce((sum, p) => sum + p.amount, 0);

    const membershipDistribution = {
      Silver: scopedCustomers.filter(c => c.membership && c.membership.tier === 'Silver').length,
      Gold: scopedCustomers.filter(c => c.membership && c.membership.tier === 'Gold').length,
      Diamond: scopedCustomers.filter(c => c.membership && c.membership.tier === 'Diamond').length
    };

    const revenueTrend = scopedOrders.length === 0 ? [] : [
      { month: 'Oct', revenue: Math.round(totalRevenue * 0.12), orders: Math.round(scopedOrders.length * 1.5) },
      { month: 'Nov', revenue: Math.round(totalRevenue * 0.18), orders: Math.round(scopedOrders.length * 1.8) },
      { month: 'Dec', revenue: Math.round(totalRevenue * 0.25), orders: Math.round(scopedOrders.length * 2.2) },
      { month: 'Jan', revenue: Math.round(totalRevenue * 0.20), orders: Math.round(scopedOrders.length * 1.9) },
      { month: 'Feb', revenue: Math.round(totalRevenue * 0.22), orders: Math.round(scopedOrders.length * 2.0) },
      { month: 'Mar', revenue: Math.round(totalRevenue * 0.28), orders: Math.round(scopedOrders.length * 2.5) }
    ];

    const orderStatusBreakdown = [
      { status: 'Delivered', count: scopedOrders.filter(o => o.status === 'Delivered').length },
      { status: 'Shipped / Out for Delivery', count: scopedOrders.filter(o => ['Shipped', 'Out for Delivery'].includes(o.status)).length },
      { status: 'Processing', count: scopedOrders.filter(o => o.status === 'Processing').length }
    ];

    return res.json({
      success: true,
      role: user.role,
      scope: {
        state: user.state,
        district: user.district,
        division: user.division,
        pincode: user.pincode
      },
      metrics: {
        totalCustomers: scopedCustomers.length,
        totalVendors: scopedVendors.length,
        totalOrders: scopedOrders.length,
        totalBookings: scopedBookings.length,
        totalJobs: scopedJobs.length,
        totalTechnicians: scopedTechnicians.length,
        totalExecutives: scopedExecutives.length,
        totalSupportTickets: scopedSupport.length,
        totalAgents: scopedAgents.length,
        totalKYC: scopedKYC.length,
        totalPincodes: scopedPincodes.length,
        totalRevenue,
        pendingAgentPayouts,
        pendingVendorPayouts
      },
      membershipDistribution,
      revenueTrend,
      orderStatusBreakdown
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to generate dashboard summary', error: error.message });
  }
}

function getBusinessReports(req, res) {
  try {
    const user = req.user;
    const scopedOrders = filterByLocation(db.orders, user);
    const scopedBookings = filterByLocation(db.bookings, user);
    const scopedCustomers = filterByLocation(db.customers, user);
    const scopedVendors = filterByLocation(db.vendors, user);

    const report = {
      generatedAt: new Date().toISOString(),
      adminScope: `${user.role} - ${user.pincode || user.division || user.district || user.state}`,
      summary: {
        totalSalesVolume: scopedOrders.length,
        grossSalesValue: scopedOrders.reduce((s, o) => s + o.totalAmount, 0),
        discountsGiven: scopedOrders.reduce((s, o) => s + (o.discountAmount || 0), 0),
        netRevenue: scopedOrders.reduce((s, o) => s + (o.netPayable || o.totalAmount), 0),
        totalServiceBookings: scopedBookings.length,
        activeCustomerBase: scopedCustomers.length,
        activeMerchants: scopedVendors.length
      },
      ordersList: scopedOrders,
      bookingsList: scopedBookings
    };

    return res.json({ success: true, report });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to generate business reports', error: error.message });
  }
}

// GET /api/reports/dashboard - Manager Portal KPI widgets and analytics by role
const getDashboardStats = async (req, res) => {
  try {
    const user = req.user;
    const allVendors = Array.from(db.vendors);
    const vendors = filterByLocation(allVendors, user);

    const statusCounts = {
      total: vendors.length,
      active: vendors.filter(v => v.status === 'Active').length,
      pending: vendors.filter(v => v.status === 'Pending' || v.status === 'Under Review' || v.status === 'Pending Verification').length,
      underReview: vendors.filter(v => v.status === 'Under Review' || v.status === 'Pending KYC Review').length,
      rejected: vendors.filter(v => v.status === 'Rejected' || v.status === 'KYC Rejected').length,
      inactive: vendors.filter(v => v.status === 'Inactive').length
    };

    const categoryCounts = {};
    vendors.forEach(v => {
      const cat = v.category || 'Services';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    const allUsers = Array.from(db.users);
    let scopedManagers = allUsers;
    let managersBreakdownText = 'Active Managers';

    const rawRole = user.role || '';
    if (rawRole.includes('state') || rawRole === 'State Admin') {
      scopedManagers = allUsers.filter(u => u.stateId === user.stateId || u.state === user.state);
      const dCount = scopedManagers.filter(u => u.role === 'district_manager' || u.role === 'District Admin').length;
      const vCount = scopedManagers.filter(u => u.role === 'division_manager' || u.role === 'Divisional Admin').length;
      const pCount = scopedManagers.filter(u => u.role === 'pincode_manager' || u.role === 'Pincode Admin').length;
      managersBreakdownText = `${dCount} District | ${vCount} Division | ${pCount} Pincode`;
    } else if (rawRole.includes('district') || rawRole === 'District Admin') {
      scopedManagers = allUsers.filter(u => u.districtId === user.districtId || u.district === user.district);
      const vCount = scopedManagers.filter(u => u.role === 'division_manager' || u.role === 'Divisional Admin').length;
      const pCount = scopedManagers.filter(u => u.role === 'pincode_manager' || u.role === 'Pincode Admin').length;
      managersBreakdownText = `${vCount} Division | ${pCount} Pincode`;
    } else {
      scopedManagers = allUsers.filter(u => u.pincodeId === user.pincodeId || u.pincode === user.pincode);
      managersBreakdownText = `${scopedManagers.length} Pincode Managers`;
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());

    const todayTieups = vendors.filter(v => v.status === 'Active' && new Date(v.createdAt) >= startOfToday).length;
    const weekTieups = vendors.filter(v => v.status === 'Active' && new Date(v.createdAt) >= startOfWeek).length;

    const kpiMetrics = {
      totalManagers: scopedManagers.length,
      managersBreakdown: managersBreakdownText,
      totalVendors: vendors.length,
      activeVendors: statusCounts.active,
      pendingVendors: statusCounts.pending,
      totalShops: vendors.length,
      activeShops: statusCounts.active,
      inactiveShops: statusCounts.inactive + statusCounts.rejected,
      totalTieups: statusCounts.active,
      todayTieups,
      weekTieups,
      verifiedVendors: statusCounts.active,
      openIssues: 0,
      kycPending: statusCounts.pending,
      vendorRequests: statusCounts.pending
    };

    const recentVendors = [...vendors]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 5);

    const issueCounts = {
      total: 0,
      open: 0,
      inProgress: 0,
      escalated: 0,
      resolved: 0
    };

    res.json({
      success: true,
      role: user.role,
      statusCounts,
      issueCounts,
      categoryCounts,
      kpiMetrics,
      recentVendors
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ success: false, message: 'Failed to compile dashboard metrics' });
  }
};

// GET /api/reports/vendors - Report data export
const getVendorReportData = async (req, res) => {
  try {
    const user = req.user;
    const allVendors = Array.from(db.vendors);
    const vendors = filterByLocation(allVendors, user);

    const detailedList = vendors.map(v => ({
      id: v._id || v.id,
      name: v.name || v.businessName,
      mobile: v.mobile || v.phone,
      email: v.email,
      businessName: v.businessName || v.name,
      category: v.category,
      subCategory: v.subCategory || 'General',
      status: v.status,
      state: v.state,
      district: v.district,
      division: v.division,
      pincode: v.pincode,
      area: v.address || '',
      createdAt: v.createdAt
    }));

    res.json({
      success: true,
      total: detailedList.length,
      data: detailedList
    });
  } catch (err) {
    console.error('Vendor report error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate report' });
  }
};

// GET /api/reports/leaderboard
const getLeaderboardData = async (req, res) => {
  try {
    const user = req.user;
    const allUsers = Array.from(db.users);
    const allVendors = Array.from(db.vendors);

    const managers = allUsers.filter(u => 
      ['state_manager', 'district_manager', 'division_manager', 'pincode_manager'].includes(u.role)
    );

    const formatRoleLabel = (role) => {
      switch (role) {
        case 'state_manager': return 'State Manager';
        case 'district_manager': return 'District Manager';
        case 'division_manager': return 'Division Manager';
        case 'pincode_manager': return 'Pincode Manager';
        default: return role;
      }
    };

    const colorPalette = ['#0284c7', '#8b5cf6', '#f59e0b', '#0d9488', '#ea580c', '#d97706', '#6366f1', '#ec4899'];

    const rankedList = managers.map((m, idx) => {
      const managerVendors = allVendors.filter(v => 
        v.createdBy === m._id || v.createdBy === m.id
      );

      const totalVendors = managerVendors.length;
      const activeVendors = managerVendors.filter(v => v.status === 'Active').length;
      const pendingVendors = managerVendors.filter(v => v.status === 'Pending' || v.status === 'Under Review').length;

      const basePoints = (activeVendors * 250) + (totalVendors * 80) + 120;
      const target = Math.max(totalVendors + 2, 5);
      const slaRate = totalVendors > 0 
        ? `${Math.min(99, Math.round((activeVendors / totalVendors) * 100))}%`
        : '95.0%';

      let territoryText = m.state || 'Assigned State';
      if (m.pincode) {
        territoryText = `PIN ${m.pincode}`;
      } else if (m.division) {
        territoryText = `${m.division}, ${m.district || ''}`;
      } else if (m.district) {
        territoryText = `${m.district}, ${m.state || ''}`;
      }

      const isSelf = String(m._id || m.id) === String(user.id || user._id);

      return {
        id: m._id || m.id,
        name: m.name,
        role: m.role,
        roleLabel: formatRoleLabel(m.role),
        level: `Level ${m.level || 1}`,
        territory: territoryText,
        stateId: m.stateId,
        stateName: m.state,
        vendorsOnboarded: totalVendors,
        activeVendors,
        pendingVendors,
        target,
        slaRate,
        points: basePoints,
        isSelf,
        rating: activeVendors > 0 ? 'Excellent' : 'Good',
        avatarBg: colorPalette[idx % colorPalette.length]
      };
    });

    rankedList.sort((a, b) => b.points - a.points || b.activeVendors - a.activeVendors);

    const rankedWithPosition = rankedList.map((item, index) => ({
      ...item,
      rank: index + 1
    }));

    res.json({
      success: true,
      count: rankedWithPosition.length,
      data: rankedWithPosition,
      top3: rankedWithPosition.slice(0, 3)
    });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate leaderboard' });
  }
};


// Submit a manager period report
const submitManagerReport = async (req, res) => {
  try {
    const user = req.user;
    const {
      periodLabel,
      dateRange,
      startDate,
      endDate,
      summary,
      shopVisits = [],
      tasks = []
    } = req.body;

    if (!periodLabel) {
      return res.status(400).json({ success: false, message: 'Report period is required.' });
    }

    const reportId = `rpt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const pinPart = (user.pincode || user.division || user.district || 'GEN').replace(/\s+/g, '').toUpperCase();
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const reportNumber = `RPT-${pinPart}-${datePart}-${Math.floor(100 + Math.random() * 900)}`;

    const newReport = {
      _id: reportId,
      id: reportId,
      reportNumber,
      periodLabel,
      dateRange: dateRange || periodLabel,
      startDate: startDate || new Date().toISOString(),
      endDate: endDate || new Date().toISOString(),
      managerId: user._id || user.id,
      managerName: user.name || 'Field Manager',
      managerRole: user.role || 'pincode_manager',
      managerEmail: user.email || '',
      managerPhone: user.phone || user.mobile || '',
      state: user.state || 'Tamil Nadu',
      district: user.district || '',
      division: user.division || '',
      pincode: user.pincode || '',
      stateId: user.stateId || null,
      districtId: user.districtId || null,
      divisionId: user.divisionId || null,
      pincodeId: user.pincodeId || null,
      summary: summary || {
        totalVisits: shopVisits.length,
        interested: shopVisits.filter(v => v.interestedStatus === 'YES').length,
        notInterested: shopVisits.filter(v => v.interestedStatus === 'NO').length,
        newTieups: shopVisits.filter(v => v.vendorId).length,
        tasksAssigned: tasks.length,
        tasksCompleted: tasks.filter(t => t.status === 'Completed').length,
        tasksPending: tasks.filter(t => t.status !== 'Completed').length
      },
      shopVisits,
      tasks,
      status: 'Submitted',
      submittedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    if (db.submittedReports) {
      db.submittedReports.push(newReport);
    }

    return res.status(201).json({
      success: true,
      message: 'Report submitted successfully and forwarded to supervisory managers.',
      data: newReport
    });
  } catch (err) {
    console.error('Submit report error:', err);
    return res.status(500).json({ success: false, message: 'Failed to submit report', error: err.message });
  }
};

// Get hierarchical submitted reports
const getSubmittedReports = async (req, res) => {
  try {
    const user = req.user;
    const allReports = Array.from(db.submittedReports || []);
    const { district, division, pincode, managerRole, period, search } = req.query;

    const rawRole = (user?.role || '').toLowerCase();

    // 1. RBAC Hierarchy Filter (Strict Territory Cascading)
    let filtered = allReports.filter(rpt => {
      // Super Admin / Admin: unrestricted access to all submitted reports
      if (rawRole.includes('super admin') || rawRole === 'admin' || user.role === 'Super Admin') return true;

      const userState = (user.state || user.scope?.stateName || '').toLowerCase();
      const rptState = (rpt.state || '').toLowerCase();
      const userDist = (user.district || user.scope?.districtName || '').toLowerCase();
      const rptDist = (rpt.district || '').toLowerCase();
      const userDiv = (user.division || user.scope?.divisionName || '').toLowerCase();
      const rptDiv = (rpt.division || '').toLowerCase();
      const userPin = String(user.pincode || user.pincodeCode || user.scope?.pincodeCode || '').trim();
      const rptPin = String(rpt.pincode || '').trim();

      // State Admin / State Manager: sees all reports across all districts, divisions, pincodes in their state
      if (rawRole.includes('state')) {
        if (!userState || userState === 'all india') return true;
        return rptState === userState || (user.stateId && rpt.stateId === user.stateId);
      }

      // District Admin / District Manager: sees all reports across all divisions and pincodes in their district
      if (rawRole.includes('district')) {
        if (!userDist) return true;
        const matchDist = rptDist === userDist || (user.districtId && rpt.districtId && String(rpt.districtId).toLowerCase().includes(userDist));
        return matchDist;
      }

      // Divisional Admin / Division Manager: sees all reports across all pincodes in their division
      if (rawRole.includes('division') || rawRole.includes('divisional')) {
        if (!userDiv) return true;
        const matchDiv = rptDiv === userDiv || (user.divisionId && rpt.divisionId === user.divisionId);
        return matchDiv;
      }

      // Pincode Admin / Pincode Manager: sees reports in their assigned pincode or self
      if (rawRole.includes('pincode')) {
        const isSelf = rpt.managerId === user._id || rpt.managerId === user.id;
        const isPin = userPin && (rptPin === userPin || rpt.pincodeId === user.pincodeId);
        return isPin || isSelf;
      }

      return false;
    });

    // 2. Query Filters
    if (district && district !== 'All') {
      filtered = filtered.filter(r => r.district === district || r.districtId === district);
    }
    if (division && division !== 'All') {
      filtered = filtered.filter(r => r.division === division || r.divisionId === division);
    }
    if (pincode && pincode !== 'All') {
      filtered = filtered.filter(r => r.pincode === pincode || r.pincodeId === pincode);
    }
    if (managerRole && managerRole !== 'All') {
      filtered = filtered.filter(r => (r.managerRole || '').toLowerCase().includes(managerRole.toLowerCase()));
    }
    if (period && period !== 'All') {
      filtered = filtered.filter(r => (r.periodLabel || '').toLowerCase().includes(period.toLowerCase()));
    }
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      filtered = filtered.filter(r =>
        (r.managerName && r.managerName.toLowerCase().includes(q)) ||
        (r.reportNumber && r.reportNumber.toLowerCase().includes(q)) ||
        (r.pincode && r.pincode.toLowerCase().includes(q)) ||
        (r.district && r.district.toLowerCase().includes(q)) ||
        (r.division && r.division.toLowerCase().includes(q))
      );
    }

    // Sort newest first
    filtered.sort((a, b) => new Date(b.submittedAt || b.createdAt) - new Date(a.submittedAt || a.createdAt));

    // Extract available hierarchy filters based on visible reports
    const availableDistricts = Array.from(new Set(filtered.map(r => r.district).filter(Boolean)));
    const availableDivisions = Array.from(new Set(filtered.map(r => r.division).filter(Boolean)));
    const availablePincodes = Array.from(new Set(filtered.map(r => r.pincode).filter(Boolean)));

    return res.json({
      success: true,
      data: filtered,
      count: filtered.length,
      hierarchy: {
        districts: availableDistricts,
        divisions: availableDivisions,
        pincodes: availablePincodes
      }
    });
  } catch (err) {
    console.error('Get submitted reports error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve submitted reports', error: err.message });
  }
};

// Get single submitted report by ID
const getSubmittedReportById = async (req, res) => {
  try {
    const { id } = req.params;
    const allReports = Array.from(db.submittedReports || []);
    const report = allReports.find(r => r._id === id || r.id === id || r.reportNumber === id);

    if (!report) {
      return res.status(404).json({ success: false, message: 'Submitted report not found.' });
    }

    // Enrich shop visits with live vendor approval & kyc info if applicable
    const enrichedVisits = (report.shopVisits || []).map(v => {
      if (v.vendorId) {
        const found = Array.from(db.vendors || []).find(vend => vend.id === v.vendorId || vend._id === v.vendorId);
        if (found) {
          return {
            ...v,
            vendor: {
              id: found.id || found._id,
              businessName: found.businessName || found.name,
              contactPerson: found.contactPerson || found.ownerName,
              phone: found.phone || found.mobile,
              approvalStatus: found.approvalStatus || 'Pending Pincode Admin Approval',
              kycStatus: found.kycStatus || 'Pending Verification',
              status: found.status || 'Under Review',
              adminApprovedBy: found.adminApprovedBy || null,
              documents: found.documents || []
            }
          };
        }
      }
      return v;
    });

    return res.json({
      success: true,
      data: {
        ...report,
        shopVisits: enrichedVisits
      }
    });
  } catch (err) {
    console.error('Get report by ID error:', err);
    return res.status(500).json({ success: false, message: 'Failed to get report details', error: err.message });
  }
};

// Approve a submitted manager report (Pincode Admin only, for pincode_manager reports)
const approveManagerReport = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { remarks } = req.body;

    const rawRole = (user?.role || '').toLowerCase();
    // Only Pincode Admin (and higher roles) can approve reports
    const canApprove = rawRole.includes('pincode') || rawRole.includes('district') ||
                       rawRole.includes('division') || rawRole.includes('state') ||
                       rawRole.includes('super') || rawRole === 'admin';

    if (!canApprove) {
      return res.status(403).json({ success: false, message: 'You do not have permission to approve reports.' });
    }

    const allReports = Array.from(db.submittedReports || []);
    const reportIndex = allReports.findIndex(r => r._id === id || r.id === id || r.reportNumber === id);

    if (reportIndex === -1) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }

    const report = allReports[reportIndex];

    // Scope check: Pincode Admin can only approve reports in their pincode
    if (rawRole.includes('pincode admin') || rawRole === 'pincode_admin') {
      const userPin = String(user.pincode || user.pincodeCode || '').trim();
      const rptPin = String(report.pincode || '').trim();
      if (userPin && rptPin !== userPin) {
        return res.status(403).json({ success: false, message: 'You can only approve reports from your assigned pincode.' });
      }
    }

    // Update approval status
    const updatedReport = {
      ...report,
      approvalStatus: 'Approved',
      status: 'Approved',
      approvedBy: user.name || user.username || 'Admin',
      approvedByRole: user.role,
      approvedByUserId: user._id || user.id,
      approvedAt: new Date().toISOString(),
      approvalRemarks: remarks || ''
    };

    allReports[reportIndex] = updatedReport;
    db.submittedReports = allReports;

    // Persist to JSON file
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, '../data/submitted_reports.json');
    fs.writeFileSync(filePath, JSON.stringify(allReports, null, 2), 'utf-8');

    return res.json({
      success: true,
      message: `Report ${report.reportNumber} approved successfully.`,
      data: updatedReport
    });
  } catch (err) {
    console.error('Approve report error:', err);
    return res.status(500).json({ success: false, message: 'Failed to approve report', error: err.message });
  }
};

// Reject a submitted manager report with remarks
const rejectManagerReport = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { remarks } = req.body;

    const rawRole = (user?.role || '').toLowerCase();
    const canReject = rawRole.includes('pincode') || rawRole.includes('district') ||
                      rawRole.includes('division') || rawRole.includes('state') ||
                      rawRole.includes('super') || rawRole === 'admin';

    if (!canReject) {
      return res.status(403).json({ success: false, message: 'You do not have permission to reject reports.' });
    }

    const allReports = Array.from(db.submittedReports || []);
    const reportIndex = allReports.findIndex(r => r._id === id || r.id === id || r.reportNumber === id);

    if (reportIndex === -1) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }

    const report = allReports[reportIndex];

    // Scope check
    if (rawRole.includes('pincode admin') || rawRole === 'pincode_admin') {
      const userPin = String(user.pincode || user.pincodeCode || '').trim();
      const rptPin = String(report.pincode || '').trim();
      if (userPin && rptPin !== userPin) {
        return res.status(403).json({ success: false, message: 'You can only reject reports from your assigned pincode.' });
      }
    }

    const updatedReport = {
      ...report,
      approvalStatus: 'Rejected',
      status: 'Rejected',
      rejectedBy: user.name || user.username || 'Admin',
      rejectedByRole: user.role,
      rejectedByUserId: user._id || user.id,
      rejectedAt: new Date().toISOString(),
      rejectionRemarks: remarks || 'Report rejected by supervisor.'
    };

    allReports[reportIndex] = updatedReport;
    db.submittedReports = allReports;

    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, '../data/submitted_reports.json');
    fs.writeFileSync(filePath, JSON.stringify(allReports, null, 2), 'utf-8');

    return res.json({
      success: true,
      message: `Report ${report.reportNumber} rejected.`,
      data: updatedReport
    });
  } catch (err) {
    console.error('Reject report error:', err);
    return res.status(500).json({ success: false, message: 'Failed to reject report', error: err.message });
  }
};

module.exports = {
  getDashboardSummary,
  getBusinessReports,
  getDashboardStats,
  getVendorReportData,
  getLeaderboardData,
  submitManagerReport,
  getSubmittedReports,
  getSubmittedReportById,
  approveManagerReport,
  rejectManagerReport
};

