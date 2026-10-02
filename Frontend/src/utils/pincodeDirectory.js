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
  if (!role) return fallbackType === 'Agent' ? 'Pincode Agent' : 'Pincode Manager';
  const r = String(role).toLowerCase().replace(/_/g, ' ').trim();
  if (r.includes('pincode') && r.includes('manager')) return 'Pincode Manager';
  if (r.includes('divis') && r.includes('manager')) return 'Divisional Manager';
  if (r.includes('dist') && r.includes('manager')) return 'District Manager';
  if (r.includes('state') && r.includes('manager')) return 'State Manager';
  if (r === 'manager') return 'Field Manager';
  if (r.includes('pincode') && r.includes('agent')) return 'Pincode Agent';
  if (r.includes('divis') && r.includes('agent')) return 'Divisional Agent';
  if (r.includes('dist') && r.includes('agent')) return 'District Agent';
  if (r.includes('state') && r.includes('agent')) return 'State Agent';
  if (r.includes('agent')) return 'Pincode Agent';
  if (r.includes('pincode') && r.includes('admin')) return 'Pincode Admin';
  if (r.includes('divis') && r.includes('admin')) return 'Divisional Admin';
  if (r.includes('dist') && r.includes('admin')) return 'District Admin';
  if (r.includes('state') && r.includes('admin')) return 'State Admin';
  if (r.includes('super') && r.includes('admin')) return 'Super Admin';
  return role;
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

  // 1. Explicit onboarding / creation role and name from API / canonical DB
  if (vendor.onboardedByName || vendor.createdByName || vendor.onboardedByRole || vendor.createdByRole) {
    const rawRole = vendor.onboardedByRole || vendor.createdByRole || vendor.addedBy?.role;
    const cleanRole = formatActorRole(rawRole);
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
    let cleanRole = formatActorRole(vendor.addedBy.role);
    // Safety check: if role says Admin but actor ID is a manager ID
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
    let cleanRole = formatActorRole(vendor.onboardedByInfo.role);
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
