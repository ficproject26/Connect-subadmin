const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const seed = require('../data/seedData');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Collection represents a persistent JSON store that also behaves seamlessly
 * as an in-memory Array for synchronous array operations (filter, find, map, etc.)
 * while providing MongoDB-style async methods (find, findOne, findById, insertOne, etc.).
 */
class Collection extends Array {
  constructor(name, initialData = []) {
    super();
    this.name = name;
    this.filePath = path.join(DATA_DIR, `${name}.json`);
    this._ensureFile(initialData);
    this._load();
  }

  _ensureFile(defaultData = []) {
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify(defaultData, null, 2), 'utf-8');
    }
  }

  _load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf-8');
        const items = JSON.parse(content || '[]');
        this.length = 0;
        this.push(...items);
      }
    } catch (err) {
      console.error(`Error loading collection ${this.name}:`, err.message);
    }
  }

  _persist() {
    try {
      const plainArray = Array.from(this);
      fs.writeFileSync(this.filePath, JSON.stringify(plainArray, null, 2), 'utf-8');
    } catch (err) {
      console.error(`Error persisting collection ${this.name}:`, err.message);
    }
  }

  // Override mutating Array methods so changes persist automatically
  push(...items) {
    const res = super.push(...items);
    this._persist();
    return res;
  }

  unshift(...items) {
    const res = super.unshift(...items);
    this._persist();
    return res;
  }

  splice(...args) {
    const res = super.splice(...args);
    this._persist();
    return res;
  }

  /**
   * Dual-mode find:
   * 1. If passed a function `(item => ...)`, operates synchronously as Array.prototype.find.
   * 2. If passed a query object `{ role: 'state_manager' }` or nothing, returns Promise of matching items.
   */
  find(queryOrFn) {
    if (typeof queryOrFn === 'function') {
      return super.find(queryOrFn);
    }

    const query = queryOrFn || {};
    const results = Array.from(this).filter(item => {
      for (const [key, val] of Object.entries(query)) {
        if (val === undefined || val === null) continue;
        if (item[key] !== val) return false;
      }
      return true;
    });

    return Promise.resolve(results);
  }

  async findOne(query = {}) {
    const items = Array.from(this);
    if (typeof query === 'function') {
      return items.find(query) || null;
    }
    return items.find(item => {
      for (const [key, val] of Object.entries(query)) {
        if (val === undefined || val === null) continue;
        if (item[key] !== val) return false;
      }
      return true;
    }) || null;
  }

  async findById(id) {
    if (!id) return null;
    const strId = String(id);
    return Array.from(this).find(item => String(item._id || item.id) === strId) || null;
  }

  async insertOne(doc) {
    const newDoc = {
      _id: doc._id || doc.id || uuidv4(),
      id: doc.id || doc._id || uuidv4(),
      ...doc,
      createdAt: doc.createdAt || new Date().toISOString(),
      updatedAt: doc.updatedAt || new Date().toISOString()
    };
    if (!newDoc.id) newDoc.id = newDoc._id;
    if (!newDoc._id) newDoc._id = newDoc.id;

    super.push(newDoc);
    this._persist();
    return newDoc;
  }

  async insertMany(docs) {
    const newDocs = docs.map(doc => {
      const generated = doc._id || doc.id || uuidv4();
      return {
        _id: generated,
        id: generated,
        ...doc,
        createdAt: doc.createdAt || new Date().toISOString(),
        updatedAt: doc.updatedAt || new Date().toISOString()
      };
    });
    super.push(...newDocs);
    this._persist();
    return newDocs;
  }

  async updateOne(query, update) {
    const index = Array.from(this).findIndex(item => {
      for (const [key, val] of Object.entries(query)) {
        if (item[key] !== val) return false;
      }
      return true;
    });

    if (index === -1) return null;

    const current = this[index];
    const patch = update.$set ? update.$set : update;
    const updated = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString()
    };

    this[index] = updated;
    this._persist();
    return updated;
  }

  async findByIdAndUpdate(id, update) {
    const strId = String(id);
    const index = Array.from(this).findIndex(item => String(item._id || item.id) === strId);
    if (index === -1) return null;

    const current = this[index];
    const patch = update.$set ? update.$set : update;
    const updated = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString()
    };

    this[index] = updated;
    this._persist();
    return updated;
  }

  async update(doc) {
    if (!doc) return null;
    const docId = doc._id || doc.id;
    if (!docId) return null;
    return this.findByIdAndUpdate(docId, doc);
  }

  async deleteOne(query) {
    const index = Array.from(this).findIndex(item => {
      for (const [key, val] of Object.entries(query)) {
        if (item[key] !== val) return false;
      }
      return true;
    });

    if (index !== -1) {
      this.splice(index, 1);
      return { deletedCount: 1 };
    }
    return { deletedCount: 0 };
  }

  async count(query = {}) {
    const items = await this.find(query);
    return items.length;
  }

  async clear() {
    this.length = 0;
    this._persist();
  }
}

// Instantiate persistent collections
const usersCollection = new Collection('users');
const statesCollection = new Collection('states');
const districtsCollection = new Collection('districts');
const divisionsCollection = new Collection('divisions');
const pincodesCollection = new Collection('pincodes');
const vendorsCollection = new Collection('vendors');
const auditLogsCollection = new Collection('audit_logs');

// Harmonize demo admins and manager users into unified usersCollection
function initUsers() {
  const existingUsers = Array.from(usersCollection);
  const existingEmails = new Set(existingUsers.map(u => (u.email || '').toLowerCase()));

  for (const admin of seed.admins) {
    if (!existingEmails.has(admin.email.toLowerCase())) {
      const stateId = admin.state === 'Tamil Nadu' ? 'state_tn' : null;
      const districtId = admin.district === 'Salem' ? 'dist_salem' : null;
      let divisionId = null;
      if (admin.division === 'Salem North') divisionId = 'div_dist_salem_urban';
      let pincodeId = null;
      if (admin.pincode === '636001') pincodeId = 'pin_636001';
      if (admin.pincode === '636002') pincodeId = 'pin_636002';

      usersCollection.push({
        _id: admin.id,
        id: admin.id,
        name: admin.name,
        email: admin.email,
        mobile: admin.phone.replace(/[^0-9]/g, '').slice(-10),
        phone: admin.phone,
        passwordHash: admin.passwordHash,
        role: admin.role,
        level: admin.role === 'State Admin' ? 1 : admin.role === 'District Admin' ? 2 : admin.role === 'Divisional Admin' ? 3 : 4,
        state: admin.state,
        district: admin.district,
        division: admin.division,
        pincode: admin.pincode,
        stateId,
        districtId,
        divisionId,
        pincodeId,
        regionId: stateId,
        status: 'active',
        avatar: admin.avatar,
        avatarUrl: admin.avatar,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      existingEmails.add(admin.email.toLowerCase());
    }
  }
}

initUsers();

// Full database store
const db = {
  // Persistent collections
  users: usersCollection,
  states: statesCollection,
  districts: districtsCollection,
  divisions: divisionsCollection,
  pincodes: pincodesCollection,
  vendors: vendorsCollection,
  auditLogs: auditLogsCollection,

  // Admin access alias
  get admins() {
    return Array.from(usersCollection).filter(u => 
      u.role === 'State Admin' || 
      u.role === 'District Admin' || 
      u.role === 'Divisional Admin' || 
      u.role === 'Division Admin' ||
      u.role === 'Pincode Admin' ||
      u.role === 'Super Admin'
    );
  },

  // In-memory / seed stores for Sub_Admin_Management workflows
  hierarchy: JSON.parse(JSON.stringify(seed.hierarchy)),
  pincodeDetails: JSON.parse(JSON.stringify(seed.pincodeDetails)),
  customers: JSON.parse(JSON.stringify(seed.customers)),
  vendorPayments: JSON.parse(JSON.stringify(seed.vendorPayments)),
  orders: JSON.parse(JSON.stringify(seed.orders)),
  bookings: JSON.parse(JSON.stringify(seed.bookings)),
  jobs: JSON.parse(JSON.stringify(seed.jobs)),
  technicians: JSON.parse(JSON.stringify(seed.technicians)),
  executives: JSON.parse(JSON.stringify(seed.executives)),
  supportTeam: JSON.parse(JSON.stringify(seed.supportTeam)),
  agents: JSON.parse(JSON.stringify(seed.agents)),
  agentPayments: JSON.parse(JSON.stringify(seed.agentPayments)),
  agentActivities: JSON.parse(JSON.stringify(seed.agentActivities || [])),
  kycRecords: JSON.parse(JSON.stringify(seed.kycRecords)),
  qualityCheckRecords: JSON.parse(JSON.stringify(seed.qualityCheckRecords || []))
};

// Bootstrap hierarchy from users so registered districts/divisions are always available
function syncHierarchyFromUsers() {
  db.hierarchy.states = [];
  const allUsers = Array.from(usersCollection);

  allUsers.forEach(u => {
    if (!u.state || u.state === 'All India') return;
    const stateName = u.state.trim();
    let stateObj = db.hierarchy.states.find(s => s.name?.toLowerCase() === stateName.toLowerCase());
    if (!stateObj) {
      stateObj = {
        id: u.stateId || (stateName === 'Tamil Nadu' ? 'state_tn' : `ST-${stateName.slice(0, 3).toUpperCase()}`),
        name: stateName,
        code: stateName.slice(0, 2).toUpperCase(),
        districts: []
      };
      db.hierarchy.states.push(stateObj);
    }

    if (u.district) {
      const dName = u.district.trim();
      let dist = stateObj.districts.find(d => d.name?.toLowerCase() === dName.toLowerCase());
      if (!dist) {
        dist = {
          id: u.districtId || (dName.toLowerCase() === 'salem' ? 'dist_salem' : `DST-${dName.replace(/\s+/g, '-').toUpperCase()}`),
          name: dName,
          code: dName.slice(0, 3).toUpperCase(),
          status: u.status === 'inactive' ? 'Inactive' : 'Active',
          divisions: []
        };
        stateObj.districts.push(dist);
      }

      if (u.division) {
        const divName = u.division.trim();
        let div = dist.divisions.find(d => d.name?.toLowerCase() === divName.toLowerCase());
        if (!div) {
          div = {
            id: u.divisionId || `DIV-${divName.replace(/\s+/g, '-').toUpperCase()}`,
            name: divName,
            code: divName.slice(0, 3).toUpperCase(),
            pincodes: []
          };
          dist.divisions.push(div);
        }

        if (u.role === 'Pincode Admin' && u.pincode && !div.pincodes.includes(u.pincode)) {
          div.pincodes.push(u.pincode);
        }
      }
    }
  });
}

syncHierarchyFromUsers();

/**
 * Enhanced location filter supporting both Sub-Admin roles and Field Manager roles.
 * Matches by geographic name ('Tamil Nadu', 'Salem') or ID ('state_tn', 'dist_salem').
 */
function filterByLocation(items, user) {
  if (!items || !Array.isArray(items)) return [];
  if (!user) return [];

  const rawRole = user.role || '';
  const role = rawRole.toLowerCase().replace(/_/g, ' ');
  const { state, district, division, pincode, stateId, districtId, divisionId, pincodeId, regionId } = user;

  return items.filter(item => {
    // Unrestricted
    if (role === 'super admin' || role === 'admin') return true;

    // Pincode level
    if (role.includes('pincode')) {
      if (pincode && item.pincode && item.pincode === pincode) return true;
      if (pincodeId && item.pincodeId && item.pincodeId === pincodeId) return true;
      if (pincode && item.pincodeCode && item.pincodeCode === pincode) return true;
      return false;
    }

    // Division level
    if (role.includes('division') || role.includes('divisional')) {
      const matchDiv = (!division || item.division === division) && (!divisionId || item.divisionId === divisionId);
      const matchDist = (!district || item.district === district) && (!districtId || item.districtId === districtId);
      const matchState = (!state || item.state === state) && (!stateId || item.stateId === stateId);
      return matchDiv && matchDist && matchState;
    }

    // District level
    if (role.includes('district')) {
      const matchDist = (!district || item.district === district) && (!districtId || item.districtId === districtId);
      const matchState = (!state || item.state === state) && (!stateId || item.stateId === stateId);
      return matchDist && matchState;
    }

    // State level
    if (role.includes('state')) {
      if (state && item.state && item.state === state) return true;
      if (stateId && item.stateId && item.stateId === stateId) return true;
      if (regionId && item.regionId && item.regionId === regionId) return true;
      return (!state || item.state === state) && (!stateId || item.stateId === stateId);
    }

    return false;
  });
}

module.exports = {
  db,
  Collection,
  filterByLocation
};
