/**
 * Universal Territory Hierarchy & Data Normalization Helper
 * Enforces role-based locking, safe string handling, and territory cascading logic.
 */

/**
 * Safely converts any value (string, object, null, undefined, number) to a safe string.
 * Prevents TypeError when calling string methods on objects or undefined values.
 */
export function safeString(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    // If it's an object with name, title, code, pincode, etc.
    const resolved = val.name || val.title || val.code || val.pincode || val.id || val._id || '';
    return typeof resolved === 'string' ? resolved.trim() : String(resolved || '');
  }
  return String(val || '').trim();
}

/**
 * Safely converts any value to lowercase trimmed string.
 * Never throws TypeError: .toLowerCase is not a function.
 */
export function safeLowerCase(val) {
  return safeString(val).toLowerCase();
}

/**
 * Extract clean territory name (state, district, division) from raw string or object.
 */
export function extractTerritoryName(val, fallback = '') {
  if (!val) return fallback;
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'object') {
    return val.name || val.districtName || val.divisionName || val.stateName || val.title || fallback;
  }
  return String(val || fallback);
}

/**
 * Extract clean pincode from raw string, number, or object.
 */
export function extractPincode(val, fallback = '') {
  if (!val) return fallback;
  if (typeof val === 'string' || typeof val === 'number') return String(val).trim();
  if (typeof val === 'object') {
    return String(val.code || val.pincode || val.name || fallback).trim();
  }
  return String(val || fallback);
}

/**
 * Safely compares two territory values (strings or objects) case-insensitively.
 */
export function matchesTerritory(a, b) {
  const normA = safeLowerCase(a);
  const normB = safeLowerCase(b);
  if (!normA || !normB) return false;
  return normA === normB;
}

/**
 * Resolves authenticated user role and territorial tier locking rules.
 * Hierarchy:
 * Super Admin (0) -> State (1) -> District (2) -> Division (3) -> Pincode (4)
 */
export function getTerritoryLocking(user) {
  if (!user) {
    return {
      tier: 'super',
      stateLocked: false,
      districtLocked: false,
      divisionLocked: false,
      pincodeLocked: false,
      defaultState: 'Tamil Nadu',
      defaultDistrict: '',
      defaultDivision: '',
      defaultPincode: ''
    };
  }

  const rawRole = safeLowerCase(user.role || user.adminRole || user.title || '');
  const userState = safeString(user.state || user.assignedState || 'Tamil Nadu');
  const userDistrict = safeString(user.district || user.assignedDistrict || '');
  const userDivision = safeString(user.division || user.assignedDivision || '');
  const userPincode = safeString(user.pincode || user.assignedPincode || '');

  // 1. Super Admin: full access, nothing locked
  const isSuperAdmin = 
    rawRole.includes('super admin') || 
    rawRole.includes('superadmin') || 
    rawRole === 'admin' ||
    rawRole === 'super';

  if (isSuperAdmin) {
    return {
      tier: 'super',
      stateLocked: false,
      districtLocked: false,
      divisionLocked: false,
      pincodeLocked: false,
      defaultState: userState,
      defaultDistrict: userDistrict,
      defaultDivision: userDivision,
      defaultPincode: userPincode
    };
  }

  // 2. Pincode Level: State, District, Division, Pincode ALL LOCKED
  const isPincodeLevel = 
    rawRole.includes('pincode') ||
    rawRole.includes('pin_code');

  if (isPincodeLevel) {
    return {
      tier: 'pincode',
      stateLocked: true,
      districtLocked: true,
      divisionLocked: true,
      pincodeLocked: true,
      defaultState: userState,
      defaultDistrict: userDistrict,
      defaultDivision: userDivision,
      defaultPincode: userPincode
    };
  }

  // 3. Division Level: State, District, Division LOCKED; Pincode selectable
  const isDivisionLevel = 
    rawRole.includes('division') || 
    rawRole.includes('divisional');

  if (isDivisionLevel) {
    return {
      tier: 'division',
      stateLocked: true,
      districtLocked: true,
      divisionLocked: true,
      pincodeLocked: false,
      defaultState: userState,
      defaultDistrict: userDistrict,
      defaultDivision: userDivision,
      defaultPincode: ''
    };
  }

  // 4. District Level: State and District LOCKED; Division and Pincode selectable
  const isDistrictLevel = 
    rawRole.includes('district');

  if (isDistrictLevel) {
    return {
      tier: 'district',
      stateLocked: true,
      districtLocked: true,
      divisionLocked: false,
      pincodeLocked: false,
      defaultState: userState,
      defaultDistrict: userDistrict,
      defaultDivision: '',
      defaultPincode: ''
    };
  }

  // 5. State Level (default for State Admin, State Agent, State Manager):
  // State LOCKED; District, Division, Pincode selectable
  return {
    tier: 'state',
    stateLocked: true,
    districtLocked: false,
    divisionLocked: false,
    pincodeLocked: false,
    defaultState: userState,
    defaultDistrict: '',
    defaultDivision: '',
    defaultPincode: ''
  };
}
