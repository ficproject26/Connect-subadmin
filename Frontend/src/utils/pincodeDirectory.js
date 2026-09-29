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
 * Resolves which Admin, Manager, or Agent added / onboarded this vendor.
 */
export function resolveVendorAddedBy(vendor) {
  if (!vendor) {
    return {
      id: '-',
      name: 'Unassigned',
      role: '-',
      phone: '-',
      email: '-',
      addedAt: '-'
    };
  }

  // 1. Direct addedBy property on vendor object
  if (vendor.addedBy && vendor.addedBy.name && vendor.addedBy.name !== 'Unassigned') {
    return {
      id: vendor.addedBy.id || '-',
      name: vendor.addedBy.name,
      role: vendor.addedBy.role || 'Agent',
      phone: vendor.addedBy.phone || '-',
      email: vendor.addedBy.email || '-',
      addedAt: vendor.addedBy.addedAt || (vendor.createdAt ? vendor.createdAt.split('T')[0] : '-')
    };
  }

  // 2. onboardedByInfo property
  if (vendor.onboardedByInfo && vendor.onboardedByInfo.name && vendor.onboardedByInfo.name !== 'Unassigned') {
    return {
      id: vendor.onboardedByInfo.id || '-',
      name: vendor.onboardedByInfo.name,
      role: vendor.onboardedByInfo.role || 'Agent',
      phone: vendor.onboardedByInfo.phone || '-',
      email: vendor.onboardedByInfo.email || '-',
      addedAt: vendor.onboardedByInfo.addedAt || (vendor.createdAt ? vendor.createdAt.split('T')[0] : '-')
    };
  }

  // 3. Fallback to assigned agent if any
  if (vendor.assignedAgent && typeof vendor.assignedAgent === 'object' && vendor.assignedAgent.name) {
    return {
      id: vendor.assignedAgent.id || vendor.assignedAgent.registrationId || '-',
      name: vendor.assignedAgent.name,
      role: vendor.assignedAgent.role ? `${vendor.assignedAgent.role} Agent` : 'Pincode Agent',
      phone: vendor.assignedAgent.phone || vendor.assignedAgent.mobile || '-',
      email: vendor.assignedAgent.email || '-',
      addedAt: vendor.createdAt ? vendor.createdAt.split('T')[0] : '-'
    };
  }

  // 4. Agent directly on vendor
  if (vendor.agentName) {
    return {
      id: vendor.agentRegistrationId || vendor.agentId || '-',
      name: vendor.agentName,
      role: 'Pincode Agent',
      phone: vendor.agentPhone || '-',
      email: '-',
      addedAt: vendor.createdAt ? vendor.createdAt.split('T')[0] : '-'
    };
  }

  // Default fallback: Unassigned
  return {
    id: '-',
    name: 'Unassigned',
    role: '-',
    phone: '-',
    email: '-',
    addedAt: vendor.createdAt ? vendor.createdAt.split('T')[0] : '-'
  };
}
