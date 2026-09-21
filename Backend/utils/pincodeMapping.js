/**
 * Comprehensive Pincode to Location Hierarchy and Assigned Team Directory
 * Automatically maps postal codes to:
 * State -> District -> Division -> Pincode
 * Resolves assigned Pincode Admin, Pincode Manager, and Pincode Agent without hardcoded mock personas.
 */

const defaultTeam = {
  pincodeAdmin: {
    id: '-',
    name: 'Unassigned',
    role: 'Pincode Admin',
    phone: '-',
    email: '-'
  },
  pincodeManager: {
    id: '-',
    name: 'Unassigned',
    role: 'Pincode Manager',
    phone: '-',
    email: '-'
  },
  pincodeAgent: {
    id: '-',
    name: 'Unassigned',
    role: 'Pincode Agent',
    phone: '-',
    email: '-'
  }
};

const PINCODE_MAP = {
  // Salem District - Salem North Division
  '636001': {
    state: 'Tamil Nadu',
    district: 'Salem',
    division: 'Salem North',
    pincode: '636001',
    areaName: 'Salem Town Fort',
    ...defaultTeam
  },
  '636002': {
    state: 'Tamil Nadu',
    district: 'Salem',
    division: 'Salem North',
    pincode: '636002',
    areaName: 'Shevapet & Market Area',
    ...defaultTeam
  },
  '636007': {
    state: 'Tamil Nadu',
    district: 'Salem',
    division: 'Salem North',
    pincode: '636007',
    areaName: 'Alagapuram',
    ...defaultTeam
  },

  // Salem District - Salem South Division
  '636003': {
    state: 'Tamil Nadu',
    district: 'Salem',
    division: 'Salem South',
    pincode: '636003',
    areaName: 'Ammapet Colony',
    ...defaultTeam
  },
  '636004': {
    state: 'Tamil Nadu',
    district: 'Salem',
    division: 'Salem South',
    pincode: '636004',
    areaName: 'Gugai',
    ...defaultTeam
  },
  '636006': {
    state: 'Tamil Nadu',
    district: 'Salem',
    division: 'Salem South',
    pincode: '636006',
    areaName: 'Kallanguthu',
    ...defaultTeam
  },

  // Salem District - Attur Division
  '636101': {
    state: 'Tamil Nadu',
    district: 'Salem',
    division: 'Attur',
    pincode: '636101',
    areaName: 'Attur Bazaar',
    ...defaultTeam
  },
  '636102': {
    state: 'Tamil Nadu',
    district: 'Salem',
    division: 'Attur',
    pincode: '636102',
    areaName: 'Attur Town H.O',
    ...defaultTeam
  },
  '636107': {
    state: 'Tamil Nadu',
    district: 'Salem',
    division: 'Attur',
    pincode: '636107',
    areaName: 'Keeripatti / Aragalur',
    ...defaultTeam
  },
  '636108': {
    state: 'Tamil Nadu',
    district: 'Salem',
    division: 'Attur',
    pincode: '636108',
    areaName: 'Narasingapuram / Malliakarai',
    ...defaultTeam
  },
  '636109': {
    state: 'Tamil Nadu',
    district: 'Salem',
    division: 'Attur',
    pincode: '636109',
    areaName: 'Peddanayakkanpalayam',
    ...defaultTeam
  },
  '636111': {
    state: 'Tamil Nadu',
    district: 'Salem',
    division: 'Attur',
    pincode: '636111',
    areaName: 'Gangavalli',
    ...defaultTeam
  },
  '636112': {
    state: 'Tamil Nadu',
    district: 'Salem',
    division: 'Attur',
    pincode: '636112',
    areaName: 'Thalaivasal / Deviyakurichi',
    ...defaultTeam
  },
  '636113': {
    state: 'Tamil Nadu',
    district: 'Salem',
    division: 'Attur',
    pincode: '636113',
    areaName: 'Thedavur',
    ...defaultTeam
  },
  '636114': {
    state: 'Tamil Nadu',
    district: 'Salem',
    division: 'Attur',
    pincode: '636114',
    areaName: 'Sentharapatti',
    ...defaultTeam
  },
  '636115': {
    state: 'Tamil Nadu',
    district: 'Salem',
    division: 'Attur',
    pincode: '636115',
    areaName: 'Veeraganur',
    ...defaultTeam
  },
  '636117': {
    state: 'Tamil Nadu',
    district: 'Salem',
    division: 'Attur',
    pincode: '636117',
    areaName: 'A. Komarapalayam',
    ...defaultTeam
  },
  '636119': {
    state: 'Tamil Nadu',
    district: 'Salem',
    division: 'Attur',
    pincode: '636119',
    areaName: 'Kallanatham / Attur West',
    ...defaultTeam
  },
  '636141': {
    state: 'Tamil Nadu',
    district: 'Salem',
    division: 'Attur',
    pincode: '636141',
    areaName: 'Mulluvadi',
    ...defaultTeam
  },
  '636142': {
    state: 'Tamil Nadu',
    district: 'Salem',
    division: 'Attur',
    pincode: '636142',
    areaName: 'Moolakurichi',
    ...defaultTeam
  },

  // Salem District - Mettur Division
  '636401': {
    state: 'Tamil Nadu',
    district: 'Salem',
    division: 'Mettur',
    pincode: '636401',
    areaName: 'Mettur Dam',
    ...defaultTeam
  },
  '636402': {
    state: 'Tamil Nadu',
    district: 'Salem',
    division: 'Mettur',
    pincode: '636402',
    areaName: 'Mecheri',
    ...defaultTeam
  },

  // Coimbatore District - Coimbatore Central
  '641001': {
    state: 'Tamil Nadu',
    district: 'Coimbatore',
    division: 'Coimbatore Central',
    pincode: '641001',
    areaName: 'Town Hall & Big Bazaar',
    ...defaultTeam
  },
  '641002': {
    state: 'Tamil Nadu',
    district: 'Coimbatore',
    division: 'Coimbatore Central',
    pincode: '641002',
    areaName: 'RS Puram & DB Road',
    ...defaultTeam
  }
};

/**
 * Resolve location hierarchy and assigned team for a given pincode.
 */
function resolvePincodeHierarchy(pincode) {
  const pin = String(pincode || '').trim();
  if (PINCODE_MAP[pin]) {
    return PINCODE_MAP[pin];
  }

  // Fallback heuristic for custom pincodes
  let state = 'Tamil Nadu';
  let district = 'Salem';
  let division = 'Salem North';

  if (pin.startsWith('641')) {
    district = 'Coimbatore';
    division = 'Coimbatore Central';
  } else if (pin.startsWith('600')) {
    district = 'Chennai';
    division = 'Chennai Central';
  } else if (pin.startsWith('625')) {
    district = 'Madurai';
    division = 'Madurai Central';
  } else if (pin.startsWith('411')) {
    state = 'Maharashtra';
    district = 'Pune';
    division = 'Pune West';
  }

  return {
    state,
    district,
    division,
    pincode: pin || '636001',
    areaName: `${division} Local Zone`,
    ...defaultTeam
  };
}

module.exports = {
  PINCODE_MAP,
  resolvePincodeHierarchy
};
