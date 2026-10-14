/**
 * Dynamic Pincode Directory & Hierarchy Resolver
 * Automatically identifies and displays the complete location hierarchy:
 * State -> District -> Division -> Pincode
 * Sourced directly from Admin Territory Database
 */

import { INDIA_POSTAL_DATA } from './indiaPostalData';

const defaultTeam = {
  pincodeAdmin: { id: '-', name: 'Unassigned', role: 'Pincode Admin', phone: '-', email: '-' },
  pincodeManager: { id: '-', name: 'Unassigned', role: 'Pincode Manager', phone: '-', email: '-' },
  pincodeAgent: { id: '-', name: 'Unassigned', role: 'Pincode Agent', phone: '-', email: '-' }
};

export const PINCODE_DIRECTORY = {};
export const AVAILABLE_PINCODES = [];

export function resolvePincodeHierarchy(pincode) {
  const pin = String(pincode || '').trim();
  if (!pin) {
    return {
      state: '',
      district: '',
      division: '',
      pincode: '',
      areaName: 'Not Assigned',
      ...defaultTeam
    };
  }

  // Search across dynamic Admin Postal Data
  for (const [stName, stData] of Object.entries(INDIA_POSTAL_DATA || {})) {
    if (!stData || !stData.districts) continue;
    for (const [dtName, dtData] of Object.entries(stData.districts)) {
      if (!dtData || !dtData.divisions) continue;
      for (const [divName, pins] of Object.entries(dtData.divisions)) {
        if (Array.isArray(pins) && pins.includes(pin)) {
          return {
            state: stName,
            district: dtName,
            division: divName,
            pincode: pin,
            areaName: divName + ' Area',
            ...defaultTeam
          };
        }
      }
    }
  }

  return {
    state: '',
    district: '',
    division: '',
    pincode: pin,
    areaName: 'Sector ' + pin,
    ...defaultTeam
  };
}

/**
 * Formats raw database roles into human-readable canonical titles.
 */
export function formatActorRole(role, fallbackType = 'Manager') {
  if (!role) {
    if (fallbackType === 'Agent') return 'Pincode Agent';
    if (fallbackType === 'Admin') return 'Pincode Admin';
    return 'Pincode Manager';
  }
  const r = String(role).toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ').trim();

  // Explicit Manager roles
  if (r.includes('pincode') && r.includes('manager')) return 'Pincode Manager';
  if ((r.includes('divis') || r.includes('division')) && r.includes('manager')) return 'Divisional Manager';
  if ((r.includes('dist') || r.includes('district')) && r.includes('manager')) return 'District Manager';
  if (r.includes('state') && r.includes('manager')) return 'State Manager';
  if (r === 'manager' || r === 'field manager') return 'Field Manager';

  // Explicit Agent roles
  if (r.includes('pincode') && r.includes('agent')) return 'Pincode Agent';
  if ((r.includes('divis') || r.includes('division')) && r.includes('agent')) return 'Divisional Agent';
  if ((r.includes('dist') || r.includes('district')) && r.includes('agent')) return 'District Agent';
  if (r.includes('state') && r.includes('agent')) return 'State Agent';

  // Explicit Admin roles
  if (r.includes('pincode') && r.includes('admin')) return 'Pincode Admin';
  if ((r.includes('divis') || r.includes('division')) && r.includes('admin')) return 'Divisional Admin';
  if ((r.includes('dist') || r.includes('district')) && r.includes('admin')) return 'District Admin';
  if (r.includes('state') && r.includes('admin')) return 'State Admin';
  if (r.includes('super') && r.includes('admin')) return 'Super Admin';

  // Shorthand / tier-only normalization (e.g. "pincode", "pin code", "PincodeAgent", "district", "division", "state")
  if (r.includes('pincode') || r === 'pin' || r === 'pin code' || r.includes('pincodeagent')) {
    if (fallbackType === 'Manager' || r.includes('mgr')) return 'Pincode Manager';
    if (fallbackType === 'Admin') return 'Pincode Admin';
    return 'Pincode Agent';
  }
  if (r.includes('divis') || r.includes('division') || r.includes('divisionalagent')) {
    if (fallbackType === 'Manager' || r.includes('mgr')) return 'Divisional Manager';
    if (fallbackType === 'Admin') return 'Divisional Admin';
    return 'Divisional Agent';
  }
  if (r.includes('dist') || r.includes('district') || r.includes('districtagent')) {
    if (fallbackType === 'Manager' || r.includes('mgr')) return 'District Manager';
    if (fallbackType === 'Admin') return 'District Admin';
    return 'District Agent';
  }
  if (r.includes('state') || r.includes('stateagent')) {
    if (fallbackType === 'Manager' || r.includes('mgr')) return 'State Manager';
    if (fallbackType === 'Admin') return 'State Admin';
    return 'State Agent';
  }

  if (r.includes('agent')) return 'Pincode Agent';
  if (r.includes('admin')) return 'Sub Admin';
  if (r.includes('manager')) return 'Field Manager';

  return fallbackType === 'Agent' ? 'Pincode Agent' : 'Field Manager';
}

/**
 * Resolves which Admin, Manager, or Agent added / onboarded this vendor.
 * Uses persisted onboarding actor fields directly without relying on current viewer identity.
 */
export function resolveVendorAddedBy(vendor) {
  if (!vendor) {
    return {
      id: '-',
      name: 'Not Available',
      role: 'Not Available',
      phone: 'Not Available',
      email: 'Not Available',
      addedAt: '-'
    };
  }

  // 0. Dedicated onboardingAgent object
  if (vendor.onboardingAgent && (vendor.onboardingAgent.name || vendor.onboardingAgent.id)) {
    return {
      id: vendor.onboardingAgent.id || vendor.onboardingAgent._id || '-',
      name: vendor.onboardingAgent.name || 'Not Available',
      role: formatActorRole(vendor.onboardingAgent.tier || vendor.onboardingAgent.role, 'Agent'),
      phone: vendor.onboardingAgent.phone || vendor.onboardingAgent.mobile || 'Not Available',
      email: vendor.onboardingAgent.email || 'Not Available',
      addedAt: vendor.onboardingAgent.submittedAt || vendor.submissionDate || (vendor.createdAt ? vendor.createdAt.split('T')[0] : '-')
    };
  }

  // 1. Explicit onboarding / creation role and name from API / canonical DB
  if (vendor.onboardedByName || vendor.createdByName || vendor.onboardedByRole || vendor.createdByRole) {
    const rawRole = vendor.onboardedByRole || vendor.createdByRole || vendor.addedBy?.role;
    const isMgr = String(rawRole).toLowerCase().includes('manager') || String(vendor.onboardedById || vendor.createdById || '').startsWith('usr_mgr');
    const isAdmin = String(rawRole).toLowerCase().includes('admin');
    const cleanRole = formatActorRole(rawRole, isMgr ? 'Manager' : isAdmin ? 'Admin' : 'Agent');
    const name = vendor.onboardedByName || vendor.createdByName || vendor.addedBy?.name;
    if (name && name !== 'Unassigned' && name !== 'Not Available') {
      return {
        id: vendor.onboardedById || vendor.createdById || vendor.addedBy?.id || '-',
        name,
        role: cleanRole,
        phone: vendor.addedBy?.phone || vendor.phone || vendor.mobile || 'Not Available',
        email: vendor.addedBy?.email || vendor.email || 'Not Available',
        addedAt: vendor.addedBy?.addedAt || (vendor.createdAt ? vendor.createdAt.split('T')[0] : '-')
      };
    }
  }

  // 2. Direct addedBy property on vendor object
  if (vendor.addedBy && vendor.addedBy.name && vendor.addedBy.name !== 'Unassigned') {
    const isMgr = String(vendor.addedBy.role || '').toLowerCase().includes('manager') || String(vendor.addedBy.id || '').startsWith('usr_mgr');
    const isAdmin = String(vendor.addedBy.role || '').toLowerCase().includes('admin');
    let cleanRole = formatActorRole(vendor.addedBy.role, isMgr ? 'Manager' : isAdmin ? 'Admin' : 'Agent');
    if (cleanRole.includes('Admin') && String(vendor.addedBy.id || '').startsWith('usr_mgr')) {
      cleanRole = 'Pincode Manager';
    }
    return {
      id: vendor.addedBy.id || '-',
      name: vendor.addedBy.name,
      role: cleanRole,
      phone: vendor.addedBy.phone || 'Not Available',
      email: vendor.addedBy.email || 'Not Available',
      addedAt: vendor.addedBy.addedAt || (vendor.createdAt ? vendor.createdAt.split('T')[0] : '-')
    };
  }

  // 3. onboardedByInfo property
  if (vendor.onboardedByInfo && vendor.onboardedByInfo.name && vendor.onboardedByInfo.name !== 'Unassigned') {
    const isMgr = String(vendor.onboardedByInfo.role || '').toLowerCase().includes('manager') || String(vendor.onboardedByInfo.id || '').startsWith('usr_mgr');
    const isAdmin = String(vendor.onboardedByInfo.role || '').toLowerCase().includes('admin');
    let cleanRole = formatActorRole(vendor.onboardedByInfo.role, isMgr ? 'Manager' : isAdmin ? 'Admin' : 'Agent');
    if (cleanRole.includes('Admin') && String(vendor.onboardedByInfo.id || '').startsWith('usr_mgr')) {
      cleanRole = 'Pincode Manager';
    }
    return {
      id: vendor.onboardedByInfo.id || '-',
      name: vendor.onboardedByInfo.name,
      role: cleanRole,
      phone: vendor.onboardedByInfo.phone || 'Not Available',
      email: vendor.onboardedByInfo.email || 'Not Available',
      addedAt: vendor.onboardedByInfo.addedAt || (vendor.createdAt ? vendor.createdAt.split('T')[0] : '-')
    };
  }

  // 4. Fallback to assigned agent if any
  if (vendor.assignedAgent && typeof vendor.assignedAgent === 'object' && vendor.assignedAgent.name) {
    return {
      id: vendor.assignedAgent.id || vendor.assignedAgent.registrationId || '-',
      name: vendor.assignedAgent.name,
      role: formatActorRole(vendor.assignedAgent.role, 'Agent'),
      phone: vendor.assignedAgent.phone || vendor.assignedAgent.mobile || 'Not Available',
      email: vendor.assignedAgent.email || 'Not Available',
      addedAt: vendor.createdAt ? vendor.createdAt.split('T')[0] : '-'
    };
  }

  // 5. Agent directly on vendor
  if (vendor.agentName) {
    return {
      id: vendor.agentRegistrationId || vendor.agentId || '-',
      name: vendor.agentName,
      role: 'Pincode Agent',
      phone: vendor.agentPhone || 'Not Available',
      email: 'Not Available',
      addedAt: vendor.createdAt ? vendor.createdAt.split('T')[0] : '-'
    };
  }

  // Default fallback: Not Available
  return {
    id: '-',
    name: 'Not Available',
    role: 'Not Available',
    phone: 'Not Available',
    email: 'Not Available',
    addedAt: vendor.createdAt ? vendor.createdAt.split('T')[0] : '-'
  };
}
