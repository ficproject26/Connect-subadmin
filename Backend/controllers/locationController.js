const { db } = require('../config/db');

// Helper to fetch live from Admin Master Territory API if running locally or via remote
async function fetchAdminTerritory(path, params = {}) {
  const queryStr = new URLSearchParams(params).toString();
  const endpoints = [
    'http://127.0.0.1:8004/api/territory',
    'http://localhost:8004/api/territory',
    'https://api.ficapp.in/api/territory'
  ];

  for (const base of endpoints) {
    try {
      const url = `${base}/${path}${queryStr ? '?' + queryStr : ''}`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        const json = await res.json();
        if (json.hierarchy && Array.isArray(json.hierarchy)) return json.hierarchy;
        if (json.data && Array.isArray(json.data)) return json.data;
        if (json[path] && Array.isArray(json[path])) return json[path];
        if (Array.isArray(json)) return json;
      }
    } catch (e) {
      // try next
    }
  }
  return null;
}

// Build complete hierarchical tree: State -> District -> Division -> Pincode
function buildCompleteHierarchy(scopeUser = null) {
  const rawStates = Array.from(db.states || []).filter(s => (s.status || 'Active').toLowerCase() === 'active');
  const rawDistricts = Array.from(db.districts || []).filter(d => (d.status || 'Active').toLowerCase() === 'active');
  const rawDivisions = Array.from(db.divisions || []).filter(v => (v.status || 'Active').toLowerCase() === 'active');
  const rawPincodes = Array.from(db.pincodes || []).filter(p => (p.status || 'Active').toLowerCase() === 'active');

  let fullHierarchy = rawStates.map(s => {
    const sId = String(s._id || s.id || s.stateId);
    const sName = (s.name || '').trim();

    const distList = rawDistricts.filter(d => 
      String(d.stateId) === sId || 
      String(d.stateId) === String(s._id) || 
      (d.state && d.state.toLowerCase() === sName.toLowerCase())
    );

    return {
      id: sId,
      _id: sId,
      name: sName,
      code: s.code || sName.slice(0, 2).toUpperCase(),
      status: s.status || 'Active',
      districts: distList.map(d => {
        const dId = String(d._id || d.id || d.districtId);
        const dName = (d.name || '').trim();

        const divList = rawDivisions.filter(v => 
          String(v.districtId) === dId || 
          String(v.districtId) === String(d._id) || 
          (v.district && v.district.toLowerCase() === dName.toLowerCase())
        );

        return {
          id: dId,
          _id: dId,
          districtId: d.districtId || dId,
          stateId: sId,
          stateName: sName,
          name: dName,
          code: d.code || dName.slice(0, 3).toUpperCase(),
          status: d.status || 'Active',
          divisions: divList.map(v => {
            const vId = String(v._id || v.id || v.divisionId);
            const vName = (v.name || '').trim();

            const pinList = rawPincodes.filter(p => 
              String(p.divisionId) === vId || 
              String(p.divisionId) === String(v._id) || 
              (p.division && p.division.toLowerCase() === vName.toLowerCase())
            );

            return {
              id: vId,
              _id: vId,
              divisionId: v.divisionId || vId,
              districtId: dId,
              districtName: dName,
              stateId: sId,
              stateName: sName,
              name: vName,
              code: v.code || vName.slice(0, 3).toUpperCase(),
              status: v.status || 'Active',
              pincodes: pinList.map(p => String(p.code || p.pincode).trim()).filter(Boolean),
              rawPincodes: pinList.map(p => ({
                id: String(p._id || p.id),
                _id: String(p._id || p.id),
                code: String(p.code || p.pincode).trim(),
                name: p.name || p.area || p.postOffice || String(p.code || p.pincode),
                status: p.status || 'Active'
              }))
            };
          })
        };
      })
    };
  });

  // Apply User Territory Scoping
  if (scopeUser && scopeUser.role) {
    const role = (scopeUser.role || '').toLowerCase().replace(/_/g, ' ');
    const isSuperAdmin = role.includes('super admin') || role === 'admin';

    if (!isSuperAdmin) {
      const userState = (scopeUser.state || '').trim().toLowerCase();
      const userDistrict = (scopeUser.district || '').trim().toLowerCase();
      const userDivision = (scopeUser.division || '').trim().toLowerCase();
      const userPincode = (scopeUser.pincode || '').trim();

      if (role.includes('pincode') && userPincode) {
        fullHierarchy = fullHierarchy
          .filter(s => !userState || s.name.toLowerCase() === userState)
          .map(s => ({
            ...s,
            districts: s.districts
              .filter(d => !userDistrict || d.name.toLowerCase() === userDistrict)
              .map(d => ({
                ...d,
                divisions: d.divisions
                  .filter(v => !userDivision || v.name.toLowerCase() === userDivision)
                  .map(v => ({
                    ...v,
                    pincodes: v.pincodes.filter(p => p === userPincode),
                    rawPincodes: v.rawPincodes.filter(p => p.code === userPincode)
                  }))
                  .filter(v => v.pincodes.length > 0)
              }))
              .filter(d => d.divisions.length > 0)
          }))
          .filter(s => s.districts.length > 0);
      } else if (role.includes('division') && userDivision) {
        fullHierarchy = fullHierarchy
          .filter(s => !userState || s.name.toLowerCase() === userState)
          .map(s => ({
            ...s,
            districts: s.districts
              .filter(d => !userDistrict || d.name.toLowerCase() === userDistrict)
              .map(d => ({
                ...d,
                divisions: d.divisions.filter(v => v.name.toLowerCase() === userDivision)
              }))
              .filter(d => d.divisions.length > 0)
          }))
          .filter(s => s.districts.length > 0);
      } else if (role.includes('district') && userDistrict) {
        fullHierarchy = fullHierarchy
          .filter(s => !userState || s.name.toLowerCase() === userState)
          .map(s => ({
            ...s,
            districts: s.districts.filter(d => d.name.toLowerCase() === userDistrict)
          }))
          .filter(s => s.districts.length > 0);
      } else if (role.includes('state') && userState && userState !== 'all india') {
        fullHierarchy = fullHierarchy.filter(s => s.name.toLowerCase() === userState);
      }
    }
  }

  return fullHierarchy;
}

// GET /api/territory/hierarchy or /api/hierarchy
const getHierarchy = async (req, res) => {
  try {
    const live = await fetchAdminTerritory('hierarchy');
    if (live && Array.isArray(live) && live.length > 0) {
      return res.json({ success: true, hierarchy: live, states: live });
    }

    const hierarchy = buildCompleteHierarchy(req.user);
    res.json({
      success: true,
      hierarchy,
      states: hierarchy
    });
  } catch (err) {
    console.error('getHierarchy error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve territory hierarchy' });
  }
};

// GET /api/states - Filtered by caller's scope
const getStates = async (req, res) => {
  try {
    const liveStates = await fetchAdminTerritory('states', { status: 'Active' });
    let states = Array.isArray(liveStates) ? liveStates : Array.from(db.states || []).filter(s => (s.status || 'Active').toLowerCase() === 'active');

    const user = req.user;
    if (user && user.role) {
      const role = (user.role || '').toLowerCase().replace(/_/g, ' ');
      const isSuper = role.includes('super admin') || role === 'admin';
      if (!isSuper) {
        if (user.stateId) {
          states = states.filter(s => String(s._id || s.id) === String(user.stateId));
        } else if (user.state && user.state !== 'All India') {
          states = states.filter(s => s.name?.toLowerCase() === user.state.toLowerCase());
        }
      }
    }

    res.json({ success: true, data: states, states });
  } catch (err) {
    console.error('Get states error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve states' });
  }
};

// GET /api/districts - Scoped to state / district
const getDistricts = async (req, res) => {
  try {
    const user = req.user;
    const { stateId, state } = req.query;
    const queryState = state || (user?.state !== 'All India' ? user?.state : null);
    const queryStateId = stateId || user?.stateId;

    const params = { status: 'Active' };
    if (queryStateId) params.stateId = queryStateId;
    if (queryState) params.state = queryState;

    const liveDistricts = await fetchAdminTerritory('districts', params);
    let districts = Array.isArray(liveDistricts) ? liveDistricts : Array.from(db.districts || []).filter(d => (d.status || 'Active').toLowerCase() === 'active');

    if (!Array.isArray(liveDistricts)) {
      if (queryStateId) {
        districts = districts.filter(d => String(d.stateId) === String(queryStateId));
      } else if (queryState) {
        const stateObj = Array.from(db.states || []).find(s => s.name?.toLowerCase() === queryState.toLowerCase());
        if (stateObj) {
          districts = districts.filter(d => String(d.stateId) === String(stateObj._id || stateObj.id));
        }
      }
    }

    if (user && user.role) {
      const role = (user.role || '').toLowerCase().replace(/_/g, ' ');
      const isSuper = role.includes('super admin') || role === 'admin';
      if (!isSuper) {
        if (user.districtId) {
          districts = districts.filter(d => String(d._id || d.id) === String(user.districtId));
        } else if (user.district) {
          districts = districts.filter(d => d.name?.toLowerCase() === user.district.toLowerCase());
        }
      }
    }

    res.json({ success: true, data: districts, districts });
  } catch (err) {
    console.error('Get districts error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve districts' });
  }
};

// GET /api/divisions - Scoped to district / division
const getDivisions = async (req, res) => {
  try {
    const user = req.user;
    const { districtId, district, stateId, state } = req.query;

    const queryDistrictId = districtId || user?.districtId;
    const queryDistrict = district || user?.district;

    const params = { status: 'Active' };
    if (queryDistrictId) params.districtId = queryDistrictId;
    if (queryDistrict) params.district = queryDistrict;
    if (stateId) params.stateId = stateId;
    if (state) params.state = state;

    const liveDivisions = await fetchAdminTerritory('divisions', params);
    let divisions = Array.isArray(liveDivisions) ? liveDivisions : Array.from(db.divisions || []).filter(v => (v.status || 'Active').toLowerCase() === 'active');

    if (!Array.isArray(liveDivisions)) {
      if (queryDistrictId) {
        divisions = divisions.filter(v => String(v.districtId) === String(queryDistrictId));
      } else if (queryDistrict) {
        const distObj = Array.from(db.districts || []).find(d => d.name?.toLowerCase() === queryDistrict.toLowerCase());
        if (distObj) {
          divisions = divisions.filter(v => String(v.districtId) === String(distObj._id || distObj.id) || (v.district && v.district.toLowerCase() === queryDistrict.toLowerCase()));
        }
      }
    }

    if (user && user.role) {
      const role = (user.role || '').toLowerCase().replace(/_/g, ' ');
      const isSuper = role.includes('super admin') || role === 'admin';
      if (!isSuper) {
        if (user.divisionId) {
          divisions = divisions.filter(d => String(d._id || d.id) === String(user.divisionId));
        } else if (user.division) {
          divisions = divisions.filter(d => d.name?.toLowerCase() === user.division.toLowerCase());
        }
      }
    }

    res.json({ success: true, data: divisions, divisions });
  } catch (err) {
    console.error('Get divisions error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve divisions' });
  }
};

// GET /api/pincodes - Scoped to division / pincode
const getPincodes = async (req, res) => {
  try {
    const user = req.user;
    const { divisionId, division, districtId, district, stateId } = req.query;

    const queryDivId = divisionId || user?.divisionId;
    const queryDiv = division || user?.division;

    const params = { status: 'Active' };
    if (queryDivId) params.divisionId = queryDivId;
    if (queryDiv) params.division = queryDiv;
    if (districtId) params.districtId = districtId;
    if (district) params.district = district;
    if (stateId) params.stateId = stateId;

    const livePincodes = await fetchAdminTerritory('pincodes', params);
    let pincodes = Array.isArray(livePincodes) ? livePincodes : Array.from(db.pincodes || []).filter(p => (p.status || 'Active').toLowerCase() === 'active');

    if (!Array.isArray(livePincodes)) {
      if (queryDivId) {
        pincodes = pincodes.filter(p => String(p.divisionId) === String(queryDivId));
      } else if (queryDiv) {
        const divObj = Array.from(db.divisions || []).find(v => v.name?.toLowerCase() === queryDiv.toLowerCase());
        if (divObj) {
          pincodes = pincodes.filter(p => String(p.divisionId) === String(divObj._id || divObj.id) || (p.division && p.division.toLowerCase() === queryDiv.toLowerCase()));
        }
      }
    }

    if (user && user.role) {
      const role = (user.role || '').toLowerCase().replace(/_/g, ' ');
      const isSuper = role.includes('super admin') || role === 'admin';
      if (!isSuper) {
        if (user.pincodeId) {
          pincodes = pincodes.filter(p => String(p._id || p.id) === String(user.pincodeId));
        } else if (user.pincode) {
          pincodes = pincodes.filter(p => (p.code || p.pincode) === user.pincode);
        }
      }
    }

    res.json({ success: true, data: pincodes, pincodes });
  } catch (err) {
    console.error('Get pincodes error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve pincodes' });
  }
};

module.exports = {
  getHierarchy,
  getStates,
  getDistricts,
  getDivisions,
  getPincodes,
  buildCompleteHierarchy
};
