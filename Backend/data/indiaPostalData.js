const { db } = require('../config/db');

function getIndianStates() {
  const states = Array.from(db.states || []).filter(s => (s.status || 'Active').toLowerCase() === 'active');
  return states.map(s => s.name.trim()).sort();
}

function getDistrictsForState(stateName) {
  if (!stateName) return [];
  const cleanState = stateName.trim().toLowerCase();
  const stateObj = Array.from(db.states || []).find(s => s.name?.trim().toLowerCase() === cleanState);
  if (!stateObj) return [];
  
  const stateIdStr = String(stateObj._id || stateObj.id || stateObj.stateId);
  const districts = Array.from(db.districts || []).filter(d => {
    const isStateMatch = String(d.stateId) === stateIdStr || String(d.stateId) === String(stateObj._id);
    const isActive = (d.status || 'Active').toLowerCase() === 'active';
    return isStateMatch && isActive;
  });
  return districts.map(d => d.name.trim()).sort();
}

function getDivisionsForDistrict(stateName, districtName) {
  if (!districtName) return [];
  const cleanDist = districtName.trim().toLowerCase();
  const distObj = Array.from(db.districts || []).find(d => d.name?.trim().toLowerCase() === cleanDist);
  if (!distObj) return [];

  const distIdStr = String(distObj._id || distObj.id || distObj.districtId);
  const divisions = Array.from(db.divisions || []).filter(v => {
    const isDistMatch = String(v.districtId) === distIdStr || String(v.districtId) === String(distObj._id);
    const isActive = (v.status || 'Active').toLowerCase() === 'active';
    return isDistMatch && isActive;
  });
  return divisions.map(v => v.name.trim()).sort();
}

function getPincodesForDivision(stateName, districtName, divisionName) {
  if (!divisionName) return [];
  const cleanDiv = divisionName.trim().toLowerCase();
  const divObj = Array.from(db.divisions || []).find(v => v.name?.trim().toLowerCase() === cleanDiv);
  if (!divObj) return [];

  const divIdStr = String(divObj._id || divObj.id || divObj.divisionId);
  const pins = Array.from(db.pincodes || []).filter(p => {
    const isDivMatch = String(p.divisionId) === divIdStr || String(p.divisionId) === String(divObj._id);
    const isActive = (p.status || 'Active').toLowerCase() === 'active';
    return isDivMatch && isActive;
  });
  return pins.map(p => String(p.code || p.pincode).trim()).filter(Boolean).sort();
}

// Dynamic postal data proxy
const INDIA_POSTAL_DATA = new Proxy({}, {
  get(target, prop) {
    if (typeof prop !== 'string') return undefined;
    const cleanState = prop.trim().toLowerCase();
    const stateObj = Array.from(db.states || []).find(s => s.name?.trim().toLowerCase() === cleanState);
    if (!stateObj) return undefined;

    const stateIdStr = String(stateObj._id || stateObj.id || stateObj.stateId);
    const districts = Array.from(db.districts || []).filter(d => 
      (String(d.stateId) === stateIdStr || String(d.stateId) === String(stateObj._id)) &&
      (d.status || 'Active').toLowerCase() === 'active'
    );

    const distMap = {};
    districts.forEach(d => {
      const distIdStr = String(d._id || d.id || d.districtId);
      const divisions = Array.from(db.divisions || []).filter(v => 
        (String(v.districtId) === distIdStr || String(v.districtId) === String(d._id)) &&
        (v.status || 'Active').toLowerCase() === 'active'
      );

      const divMap = {};
      divisions.forEach(v => {
        const divIdStr = String(v._id || v.id || v.divisionId);
        const pins = Array.from(db.pincodes || []).filter(p => 
          (String(p.divisionId) === divIdStr || String(p.divisionId) === String(v._id)) &&
          (p.status || 'Active').toLowerCase() === 'active'
        );
        divMap[v.name] = pins.map(p => String(p.code || p.pincode).trim()).filter(Boolean);
      });

      distMap[d.name] = {
        code: d.code,
        divisions: divMap
      };
    });

    return {
      code: stateObj.code,
      districts: distMap
    };
  },
  ownKeys() {
    return getIndianStates();
  },
  getOwnPropertyDescriptor(target, prop) {
    return {
      enumerable: true,
      configurable: true,
      value: this.get(target, prop)
    };
  }
});

module.exports = {
  INDIA_POSTAL_DATA,
  get ALL_INDIAN_STATES() { return getIndianStates(); },
  getIndianStates,
  getDistrictsForState,
  getDivisionsForDistrict,
  getPincodesForDivision
};
