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

module.exports = {
  getDashboardSummary,
  getBusinessReports,
  getDashboardStats,
  getVendorReportData,
  getLeaderboardData
};
