/**
 * Dynamic Admin-Managed Territory Hierarchy Data Provider
 * Single Source of Truth: Admin Territory Database
 * State -> District -> Division -> PIN Code
 */

const CACHE_KEY = 'admin_territory_hierarchy_cache';

// Initialize in-memory store from cache if available
function loadCachedHierarchy() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    }
  } catch (e) {
    console.warn('Could not read territory cache', e);
  }
  return {};
}

export let INDIA_POSTAL_DATA = loadCachedHierarchy();

export function getIndianStates() {
  return Object.keys(INDIA_POSTAL_DATA).sort();
}

export let ALL_INDIAN_STATES = getIndianStates();

/**
 * Rebuild INDIA_POSTAL_DATA from Admin territory hierarchy array
 */
export function buildPostalDataFromHierarchy(hierarchyArray) {
  const tree = {};
  if (!Array.isArray(hierarchyArray)) return tree;

  hierarchyArray.forEach(st => {
    if (!st || !st.name) return;
    if (st.status && st.status.toLowerCase() !== 'active') return;

    const stateName = st.name.trim();
    tree[stateName] = {
      id: st.id || st._id,
      code: st.code || stateName.slice(0, 2).toUpperCase(),
      status: st.status || 'Active',
      districts: {}
    };

    const distList = st.districts || [];
    distList.forEach(dt => {
      if (!dt || !dt.name) return;
      if (dt.status && dt.status.toLowerCase() !== 'active') return;

      const districtName = dt.name.trim();
      tree[stateName].districts[districtName] = {
        id: dt.id || dt._id,
        code: dt.code || districtName.slice(0, 3).toUpperCase(),
        status: dt.status || 'Active',
        divisions: {}
      };

      const divList = dt.divisions || [];
      divList.forEach(dv => {
        if (!dv || !dv.name) return;
        if (dv.status && dv.status.toLowerCase() !== 'active') return;

        const divisionName = dv.name.trim();
        const pins = [];
        (dv.pincodes || []).forEach(p => {
          const pinCode = typeof p === 'string' ? p : (p.code || p.pincode);
          const pinStatus = p.status || 'Active';
          if (pinCode && pinStatus.toLowerCase() === 'active') {
            pins.push(String(pinCode).trim());
          }
        });

        tree[stateName].districts[districtName].divisions[divisionName] = pins;
      });
    });
  });

  return tree;
}

/**
 * Fetch latest active hierarchy from Admin Territory API
 */
export async function syncTerritoryFromAdmin() {
  const endpoints = [
    '/api/territory/hierarchy',
    'http://127.0.0.1:8004/api/territory/hierarchy',
    'http://localhost:8004/api/territory/hierarchy',
    'https://api.ficapp.in/api/territory/hierarchy'
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (res.ok) {
        const json = await res.json();
        const hierarchy = json.hierarchy || (Array.isArray(json) ? json : null);
        if (hierarchy && Array.isArray(hierarchy)) {
          const built = buildPostalDataFromHierarchy(hierarchy);
          if (Object.keys(built).length > 0) {
            INDIA_POSTAL_DATA = built;
            ALL_INDIAN_STATES = Object.keys(built).sort();
            if (typeof window !== 'undefined' && window.localStorage) {
              try {
                localStorage.setItem(CACHE_KEY, JSON.stringify(built));
                window.dispatchEvent(new CustomEvent('territory_updated', { detail: built }));
              } catch (e) {}
            }
            return built;
          }
        }
      }
    } catch (e) {
      // Try next endpoint
    }
  }
  return INDIA_POSTAL_DATA;
}

// Auto-sync on client load
if (typeof window !== 'undefined') {
  setTimeout(() => {
    syncTerritoryFromAdmin();
  }, 100);
}

/**
 * Get districts for a given state strictly from Admin database
 */
export function getDistrictsForState(stateName) {
  if (!stateName) return [];
  const sKey = Object.keys(INDIA_POSTAL_DATA).find(k => k.toLowerCase() === stateName.trim().toLowerCase());
  if (!sKey || !INDIA_POSTAL_DATA[sKey]?.districts) return [];
  return Object.keys(INDIA_POSTAL_DATA[sKey].districts).sort();
}

/**
 * Get divisions for a given state & district strictly from Admin database
 */
export function getDivisionsForDistrict(stateName, districtName) {
  if (!stateName || !districtName) return [];
  const sKey = Object.keys(INDIA_POSTAL_DATA).find(k => k.toLowerCase() === stateName.trim().toLowerCase());
  if (!sKey || !INDIA_POSTAL_DATA[sKey]?.districts) return [];

  const stateData = INDIA_POSTAL_DATA[sKey];
  const dKey = Object.keys(stateData.districts).find(k => k.toLowerCase() === districtName.trim().toLowerCase());
  if (!dKey || !stateData.districts[dKey]?.divisions) return [];

  return Object.keys(stateData.districts[dKey].divisions).sort();
}

/**
 * Get postal PIN codes for a given state, district, and division strictly from Admin database
 */
export function getPincodesForDivision(stateName, districtName, divisionName) {
  if (!stateName || !districtName || !divisionName) return [];
  const sKey = Object.keys(INDIA_POSTAL_DATA).find(k => k.toLowerCase() === stateName.trim().toLowerCase());
  if (!sKey || !INDIA_POSTAL_DATA[sKey]?.districts) return [];

  const stateData = INDIA_POSTAL_DATA[sKey];
  const dKey = Object.keys(stateData.districts).find(k => k.toLowerCase() === districtName.trim().toLowerCase());
  if (!dKey || !stateData.districts[dKey]?.divisions) return [];

  const distData = stateData.districts[dKey];
  const divKey = Object.keys(distData.divisions).find(k => k.toLowerCase() === divisionName.trim().toLowerCase());
  if (!divKey) return [];

  return (distData.divisions[divKey] || []).sort();
}
