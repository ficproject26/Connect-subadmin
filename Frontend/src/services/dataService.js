import { apiRequest } from './api';
import { realtimeClient } from '../realtime/websocketClient';

export const dataService = {
  // Reports & Summaries
  getDashboardSummary: () => apiRequest('/reports/dashboard-summary'),
  getBusinessReports: () => apiRequest('/reports/business-reports'),
  getSubmittedManagerReports: (params = {}) => {
    const clean = {};
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '' && v !== 'All') clean[k] = v;
    });
    const qs = new URLSearchParams(clean).toString();
    return apiRequest(`/reports/submitted${qs ? `?${qs}` : ''}`);
  },
  getSubmittedManagerReportById: (id) => apiRequest(`/reports/submitted/${id}`),
  approveManagerReport: (id, remarks = '') => apiRequest(`/reports/submitted/${id}/approve`, {
    method: 'PATCH',
    body: JSON.stringify({ remarks })
  }),
  rejectManagerReport: (id, remarks = '') => apiRequest(`/reports/submitted/${id}/reject`, {
    method: 'PATCH',
    body: JSON.stringify({ remarks })
  }),

  // Hierarchy & Geo
  getHierarchy: () => apiRequest('/admin/hierarchy'),
  getTerritoryHierarchy: () => apiRequest('/territory/hierarchy'),
  getSubordinateAdmins: () => apiRequest('/admin/subordinates'),
  getStates: () => apiRequest('/admin/states'),
  addStateAdmin: (data) => apiRequest('/admin/states', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateStateStatus: (id, status) => apiRequest(`/admin/states/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  }),
  getDistricts: async (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const res = await apiRequest(`/admin/districts${qs ? `?${qs}` : ''}`);
    if (res && res.success && Array.isArray(res.districts)) {
      // Exclude districts that have no assigned admin, agent, or manager anywhere in hierarchy
      const qualifying = res.districts.filter(d => {
        const hasAdmin = d.adminName && d.adminName !== 'Unassigned' && d.adminName !== '-';
        const hasAdminCount = Number(d.adminCount || 0) > 0;
        const hasAgents = Number(d.totalAgents || 0) > 0;
        const hasManagers = Number(d.totalManagers || 0) > 0 || (Array.isArray(d.managers) && d.managers.length > 0);
        const hasDivisions = Number(d.divisionsCount || 0) > 0;
        const hasPincodes = Number(d.pincodesCount || 0) > 0;
        return hasAdmin || hasAdminCount || hasAgents || hasManagers || hasDivisions || hasPincodes;
      });
      return { ...res, districts: qualifying, total: qualifying.length };
    }
    return res;
  },
  addDistrictAdmin: (data) => apiRequest('/admin/districts', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateDistrictStatus: (id, status) => apiRequest(`/admin/districts/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  }),
  getDivisions: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/admin/divisions${qs ? `?${qs}` : ''}`);
  },
  addDivisionAdmin: (data) => apiRequest('/admin/divisions', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateDivisionStatus: (id, status) => apiRequest(`/admin/divisions/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  }),
  getPincodes: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/admin/pincodes${qs ? `?${qs}` : ''}`);
  },
  addPincodeAdmin: (data) => apiRequest('/admin/pincodes', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updatePincodeStatus: (id, status) => apiRequest(`/admin/pincodes/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  }),

  // Customers & Membership
  getCustomers: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/customers${qs ? `?${qs}` : ''}`);
  },
  getMembershipCards: () => apiRequest('/customers/membership-cards'),
  upgradeMembership: (data) => apiRequest('/customers/upgrade-membership', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  // Vendors
  getVendors: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/vendors${qs ? `?${qs}` : ''}`);
  },
  getVendorById: (id) => apiRequest(`/vendors/${id}`),
  createVendor: (data) => apiRequest('/vendors', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  lookupPincode: (pincode) => apiRequest(`/vendors/lookup-pincode/${pincode}`),
  pincodeVerifyVendor: (id, data) => apiRequest(`/vendors/${id}/pincode-verify`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  kycVerifyVendor: (id, data) => apiRequest(`/vendors/${id}/kyc-verify`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  // Orders & Bookings
  getOrders: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/orders${qs ? `?${qs}` : ''}`);
  },
  updateOrderStatus: (id, status) => apiRequest(`/orders/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  }),

  getBookings: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/bookings${qs ? `?${qs}` : ''}`);
  },
  updateBookingStatus: (id, data) => apiRequest(`/bookings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),

  // Jobs & Technicians
  getJobs: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/jobs${qs ? `?${qs}` : ''}`);
  },
  getTechnicians: () => apiRequest('/jobs/technicians'),
  updateJobStatus: (id, data) => apiRequest(`/jobs/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),

  // Payments
  getAgentPayments: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/payments/agents${qs ? `?${qs}` : ''}`);
  },
  requestAgentPayment: (data) => apiRequest('/payments/agents/request', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  processAgentPayment: (id, data) => apiRequest(`/payments/agents/${id}/process`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  getVendorPayments: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/payments/vendors${qs ? `?${qs}` : ''}`);
  },
  processVendorPayment: (id, data) => apiRequest(`/payments/vendors/${id}/process`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  // KYC
  getKYCRecords: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/kyc${qs ? `?${qs}` : ''}`);
  },
  getKYC: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/kyc${qs ? `?${qs}` : ''}`);
  },
  processKYC: (id, data) => apiRequest(`/kyc/${id}/process`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),
  updateKYC: (id, data) => apiRequest(`/kyc/${id}/process`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),

  // Quality Check (View Only from Existing Quality Check Module)
  getQualityChecks: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/quality${qs ? `?${qs}` : ''}`);
  },
  getQualityCheckById: (id) => apiRequest(`/quality/${id}`),

  // Pincode Manager
  getPincodeDetails: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/admin/pincodes${qs ? `?${qs}` : ''}`);
  },
  updatePincode: (id, status) => apiRequest(`/admin/pincodes/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  }),

  // Operations: Executives, Support Team, Agents, Delivery Partners
  getExecutives: () => apiRequest('/operations/executives'),
  getDeliveryPartners: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/operations/delivery-partners${qs ? `?${qs}` : ''}`);
  },
  getSupportTeam: () => apiRequest('/operations/support-team'),
  updateSupportTicket: (id, data) => apiRequest(`/operations/support-team/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),
  getAgents: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/operations/agents${qs ? `?${qs}` : ''}`);
  },
  getAgentHierarchy: () => apiRequest('/operations/agents/hierarchy'),
  getAgentActivities: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/operations/agents/activities${qs ? `?${qs}` : ''}`);
  },
  createAgentActivity: (data) => apiRequest('/operations/agents/activities', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  advanceAgentActivity: (id, data = {}) => apiRequest(`/operations/agents/activities/${id}/advance`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),

  // Managers & Approvals
  getManagers: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/managers${qs ? `?${qs}` : ''}`);
  },
  getManagerById: (id) => apiRequest(`/managers/${id}`),
  approveManager: (id, data = {}) => apiRequest(`/managers/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  rejectManager: (id, data = {}) => apiRequest(`/managers/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  addManager: (data) => apiRequest('/managers', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  uploadDocument: (file) => {
    const formData = new FormData();
    formData.append('document', file);
    return apiRequest('/uploads/document', {
      method: 'POST',
      body: formData
    }).catch(() => {
      // Fallback to /api/auth/upload-document if upload endpoint errors
      return apiRequest('/auth/upload-document', {
        method: 'POST',
        body: formData
      });
    });
  },

  // ─── QC Issue & Task Management ─────────────────────────────────────────────
  // QC Issues
  raiseQCIssue: (data) => apiRequest('/qc-tasks/issues', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  getQCIssues: (params = {}) => {
    const clean = {};
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '' && v !== 'All') clean[k] = v;
    });
    const qs = new URLSearchParams(clean).toString();
    return apiRequest(`/qc-tasks/issues${qs ? `?${qs}` : ''}`);
  },
  getQCIssueById: (id) => apiRequest(`/qc-tasks/issues/${id}`),

  // Tasks
  createQCTask: (data) => apiRequest('/qc-tasks/tasks', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  getQCTasks: (params = {}) => {
    const clean = {};
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '' && v !== 'All') clean[k] = v;
    });
    const qs = new URLSearchParams(clean).toString();
    return apiRequest(`/qc-tasks/tasks${qs ? `?${qs}` : ''}`);
  },
  getQCTaskById: (id) => apiRequest(`/qc-tasks/tasks/${id}`),
  updateQCTaskStatus: (id, data) => apiRequest(`/qc-tasks/tasks/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),
  submitSuspendRequest: (id, data) => apiRequest(`/qc-tasks/tasks/${id}/suspend`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  reviewSuspendRequest: (id, data) => apiRequest(`/qc-tasks/tasks/${id}/suspend/review`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),
  reviewTaskResolution: (id, data) => apiRequest(`/qc-tasks/tasks/${id}/review`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),
  reviewIssueResolution: (id, data) => apiRequest(`/qc-tasks/issues/${id}/review`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),

  // Managers scoped to admin's hierarchy
  getQCTaskManagers: () => apiRequest('/qc-tasks/managers'),

  // Vendor Subscriptions (territory-scoped)
  getVendorSubscriptions: async (params = {}) => {
    const clean = {};
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '' && v !== 'All') clean[k] = v;
    });
    const qs = new URLSearchParams(clean).toString();
    try {
      return await apiRequest(`/vendors/subscriptions${qs ? `?${qs}` : ''}`);
    } catch (err) {
      if (err.message && err.message.includes('not found')) {
        return await apiRequest(`/subscriptions${qs ? `?${qs}` : ''}`);
      }
      throw err;
    }
  },
  recordVendorSubscriptionPayment: async (id, data) => {
    try {
      return await apiRequest(`/vendors/subscriptions/${id}/record-payment`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
    } catch (err) {
      if (err.message && err.message.includes('not found')) {
        return await apiRequest(`/subscriptions/${id}/record-payment`, {
          method: 'POST',
          body: JSON.stringify(data)
        });
      }
      throw err;
    }
  },

  // Real-Time Event Subscription Helpers
  subscribeRealtime: (entity, callback) => realtimeClient.subscribe(entity, callback)
};




