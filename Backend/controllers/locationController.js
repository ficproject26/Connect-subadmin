const { db } = require('../config/db');

// Helper to fetch live from Admin Master Territory API
async function fetchAdminTerritory(path, params = {}) {
  const queryStr = new URLSearchParams(params).toString();
  const endpoints = [
    'http://127.0.0.1:8004/api/territory/',
    'http://localhost:8004/api/territory/',
    'https://api.ficapp.in/api/territory/'
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (res.ok) {
        return await res.json();
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
    let states = Array.isArray(liveStates) ? liveStates : await db.states.find({ status: 'Active' });

    const user = req.user;
    if (user?.stateId) {
      states = states.filter(s => s._id === user.stateId || s.id === user.stateId);
    } else if (user?.state) {
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
    const queryState = state || user?.state;
    const queryStateId = stateId || user?.stateId;

    const params = { status: 'Active' };
    if (queryStateId) params.stateId = queryStateId;
    if (queryState) params.state = queryState;

    const liveDistricts = await fetchAdminTerritory('districts', params);
    let districts = Array.isArray(liveDistricts) ? liveDistricts : await db.districts.find({ status: 'Active' });

    if (user?.districtId) {
      districts = districts.filter(d => d._id === user.districtId || d.id === user.districtId);
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
    let divisions = Array.isArray(liveDivisions) ? liveDivisions : await db.divisions.find({ status: 'Active' });

    if (user?.divisionId) {
      divisions = divisions.filter(d => d._id === user.divisionId || d.id === user.divisionId);
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
    const { divisionId, division, districtId, stateId } = req.query;

    const queryDivId = divisionId || user?.divisionId;
    const queryDiv = division || user?.division;

    const params = { status: 'Active' };
    if (queryDivId) params.divisionId = queryDivId;
    if (queryDiv) params.division = queryDiv;
    if (districtId) params.districtId = districtId;
    if (stateId) params.stateId = stateId;

    const livePincodes = await fetchAdminTerritory('pincodes', params);
    let pincodes = Array.isArray(livePincodes) ? livePincodes : await db.pincodes.find({ status: 'Active' });

    if (user?.pincodeId) {
      pincodes = pincodes.filter(p => p._id === user.pincodeId || p.id === user.pincodeId);
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
