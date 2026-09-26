const { db } = require('../config/db');

// Helper to fetch live from Admin Master Territory API
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
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (res.ok) {
        const json = await res.json();
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

// GET /api/states - Filtered by caller's scope
const getStates = async (req, res) => {
  try {
    const liveStates = await fetchAdminTerritory('states', { status: 'Active' });
    let states = Array.isArray(liveStates) ? liveStates : Array.from(db.states || []).filter(s => (s.status || 'Active').toLowerCase() === 'active');

    const user = req.user;
    if (user?.stateId) {
      states = states.filter(s => String(s._id || s.id) === String(user.stateId));
    } else if (user?.state && user.state !== 'All India') {
      states = states.filter(s => s.name?.toLowerCase() === user.state.toLowerCase());
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

    if (user?.districtId) {
      districts = districts.filter(d => String(d._id || d.id) === String(user.districtId));
    } else if (user?.district) {
      districts = districts.filter(d => d.name?.toLowerCase() === user.district.toLowerCase());
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
          divisions = divisions.filter(v => String(v.districtId) === String(distObj._id || distObj.id));
        }
      }
    }

    if (user?.divisionId) {
      divisions = divisions.filter(d => String(d._id || d.id) === String(user.divisionId));
    } else if (user?.division) {
      divisions = divisions.filter(d => d.name?.toLowerCase() === user.division.toLowerCase());
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
          pincodes = pincodes.filter(p => String(p.divisionId) === String(divObj._id || divObj.id));
        }
      }
    }

    if (user?.pincodeId) {
      pincodes = pincodes.filter(p => String(p._id || p.id) === String(user.pincodeId));
    } else if (user?.pincode) {
      pincodes = pincodes.filter(p => (p.code || p.pincode) === user.pincode);
    }

    res.json({ success: true, data: pincodes, pincodes });
  } catch (err) {
    console.error('Get pincodes error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve pincodes' });
  }
};

module.exports = {
  getStates,
  getDistricts,
  getDivisions,
  getPincodes
};
