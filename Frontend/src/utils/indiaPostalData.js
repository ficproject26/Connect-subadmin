/**
 * Dynamic Admin-Managed Territory Hierarchy Data Provider
 * Single Source of Truth: Admin Territory Database (MongoDB Atlas)
 * Hierarchy: State -> District -> Division -> PIN Code
 */

// In-memory runtime hierarchy store - populated exclusively from Database API
export let INDIA_POSTAL_DATA = {};

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
  const token = typeof window !== 'undefined' ? (localStorage.getItem('ams_token') || localStorage.getItem('agent_mgr_token')) : null;
  const headers = {
    'Accept': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };

  const endpoints = [
    '/api/territory/hierarchy',
    '/api/admin/hierarchy',
    '/api/hierarchy',
    'http://127.0.0.1:8004/api/territory/hierarchy',
    'http://localhost:8004/api/territory/hierarchy',
    'https://api.ficapp.in/api/territory/hierarchy'
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(2500) });
      if (res.ok) {
        const json = await res.json();
        const hierarchy = json.hierarchy || json.states || (Array.isArray(json) ? json : null);
        if (hierarchy && Array.isArray(hierarchy) && hierarchy.length > 0) {
          const built = buildPostalDataFromHierarchy(hierarchy);
          if (Object.keys(built).length > 0) {
            INDIA_POSTAL_DATA = built;
            ALL_INDIAN_STATES = Object.keys(built).sort();
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('territory_updated', { detail: built }));
            }
            return built;
          }
        }
      }
    } catch (e) {
      // Try next endpoint
    }
  }

  // Fallback: If hierarchy endpoint did not populate, query individual district/division endpoints
  try {
    const [distRes, divRes, pinRes] = await Promise.all([
      fetch('/api/districts', { headers }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/divisions', { headers }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/pincodes', { headers }).then(r => r.ok ? r.json() : null).catch(() => null)
    ]);

    const rawDistricts = distRes?.districts || distRes?.data || [];
    const rawDivisions = divRes?.divisions || divRes?.data || [];
    const rawPincodes = pinRes?.pincodes || pinRes?.data || [];

    if (rawDistricts.length > 0 || rawDivisions.length > 0) {
      const fallbackTree = { 'Tamil Nadu': { id: 'state_tn', code: 'TAM', status: 'Active', districts: {} } };
      rawDistricts.forEach(d => {
        const dName = d.name?.trim();
        if (dName) {
          fallbackTree['Tamil Nadu'].districts[dName] = {
            id: d._id || d.id,
            code: d.code || dName.slice(0, 3).toUpperCase(),
            status: d.status || 'Active',
            divisions: {}
          };
        }
      });

      rawDivisions.forEach(v => {
        const vName = v.name?.trim();
        const dName = v.districtName || v.district || 'Namakkal';
        if (!fallbackTree['Tamil Nadu'].districts[dName]) {
          fallbackTree['Tamil Nadu'].districts[dName] = { id: `dist_${dName.toLowerCase()}`, code: dName.slice(0, 3).toUpperCase(), status: 'Active', divisions: {} };
        }
        fallbackTree['Tamil Nadu'].districts[dName].divisions[vName] = [];
      });

      rawPincodes.forEach(p => {
        const pCode = String(p.code || p.pincode || '').trim();
        const vName = p.divisionName || p.division;
        const dName = p.districtName || p.district;
        if (dName && vName && fallbackTree['Tamil Nadu'].districts[dName]?.divisions[vName]) {
          if (!fallbackTree['Tamil Nadu'].districts[dName].divisions[vName].includes(pCode)) {
            fallbackTree['Tamil Nadu'].districts[dName].divisions[vName].push(pCode);
          }
        }
      });

      INDIA_POSTAL_DATA = fallbackTree;
      ALL_INDIAN_STATES = Object.keys(fallbackTree).sort();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('territory_updated', { detail: fallbackTree }));
      }
      return fallbackTree;
    }
  } catch (err) {}

  return INDIA_POSTAL_DATA;
}

// Auto-sync on client load
if (typeof window !== 'undefined') {
  setTimeout(() => {
    syncTerritoryFromAdmin();
  }, 50);
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

export function getTerritoryHierarchy() {
  return INDIA_POSTAL_DATA;
}
