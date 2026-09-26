import { apiRequest } from '../services/api';

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
  if (!token) return;

  const hierarchyEndpoints = [
    '/admin/hierarchy',
    '/territory/hierarchy',
    '/hierarchy'
  ];

  for (const endpoint of hierarchyEndpoints) {
    try {
      const json = await apiRequest(endpoint);
      const hierarchy = json?.hierarchy || json?.states || (Array.isArray(json) ? json : null);
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
    } catch (e) {
      // Continue to next endpoint
    }
  }

  // Fallback: If hierarchy endpoint did not populate, query individual territory endpoints
  try {
    const [stateRes, distRes, divRes, pinRes] = await Promise.all([
      apiRequest('/states').catch(() => null),
      apiRequest('/districts').catch(() => null),
      apiRequest('/divisions').catch(() => null),
      apiRequest('/pincodes').catch(() => null)
    ]);

    const rawStates = stateRes?.states || stateRes?.data || [];
    const rawDistricts = distRes?.districts || distRes?.data || [];
    const rawDivisions = divRes?.divisions || divRes?.data || [];
    const rawPincodes = pinRes?.pincodes || pinRes?.data || [];

    if (rawStates.length > 0 || rawDistricts.length > 0) {
      const fallbackTree = {};

      const stateList = rawStates.length > 0 ? rawStates : [{ id: 'state_default', name: 'Tamil Nadu', code: 'TAM' }];
      stateList.forEach(s => {
        const sName = s.name?.trim();
        if (sName) {
          fallbackTree[sName] = {
            id: s._id || s.id || s.stateId,
            code: s.code || sName.slice(0, 2).toUpperCase(),
            status: s.status || 'Active',
            districts: {}
          };
        }
      });

      rawDistricts.forEach(d => {
        const dName = d.name?.trim();
        if (!dName) return;
        const matchedState = stateList.find(s => 
          String(s._id || s.id || s.stateId) === String(d.stateId) || 
          (d.state && d.state.toLowerCase() === s.name.toLowerCase())
        );
        const sName = matchedState ? matchedState.name.trim() : Object.keys(fallbackTree)[0];
        if (sName && fallbackTree[sName]) {
          fallbackTree[sName].districts[dName] = {
            id: d._id || d.id || d.districtId,
            code: d.code || dName.slice(0, 3).toUpperCase(),
            status: d.status || 'Active',
            divisions: {}
          };
        }
      });

      rawDivisions.forEach(v => {
        const vName = v.name?.trim();
        if (!vName) return;

        let targetStateName = null;
        let targetDistName = null;

        for (const sName of Object.keys(fallbackTree)) {
          for (const dName of Object.keys(fallbackTree[sName].districts)) {
            const distObj = fallbackTree[sName].districts[dName];
            if (String(distObj.id) === String(v.districtId) || (v.district && v.district.toLowerCase() === dName.toLowerCase())) {
              targetStateName = sName;
              targetDistName = dName;
              break;
            }
          }
          if (targetDistName) break;
        }

        if (targetStateName && targetDistName) {
          fallbackTree[targetStateName].districts[targetDistName].divisions[vName] = [];
        }
      });

      rawPincodes.forEach(p => {
        const pCode = String(p.code || p.pincode || '').trim();
        if (!pCode) return;

        for (const sName of Object.keys(fallbackTree)) {
          for (const dName of Object.keys(fallbackTree[sName].districts)) {
            for (const vName of Object.keys(fallbackTree[sName].districts[dName].divisions)) {
              const divList = rawDivisions.filter(dv => dv.name?.trim().toLowerCase() === vName.toLowerCase());
              const isMatch = divList.some(dv => String(dv._id || dv.id || dv.divisionId) === String(p.divisionId)) ||
                (p.division && p.division.toLowerCase() === vName.toLowerCase());

              if (isMatch) {
                if (!fallbackTree[sName].districts[dName].divisions[vName].includes(pCode)) {
                  fallbackTree[sName].districts[dName].divisions[vName].push(pCode);
                }
              }
            }
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
