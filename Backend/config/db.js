const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { v4: uuidv4 } = require('uuid');
const seed = require('../data/seedData');
const { getMongoDb } = require('./mongo');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function sanitizeQuery(query) {
  if (!query || typeof query !== 'object') return {};
  const sanitized = {};
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue;
    sanitized[k] = v;
  }
  return sanitized;
}

/**
 * Collection represents a MongoDB Atlas-driven data store that also supports
 * seamless in-memory array operations for synchronous compatibility (find, filter, map, etc.)
 * while persisting all operations to MongoDB Atlas as the single source of truth.
 */
class Collection extends Array {
  constructor(name, initialData = [], mongoCollectionName = null) {
    super();
    this.name = name;
    this.mongoName = mongoCollectionName || name;
    this.filePath = path.join(DATA_DIR, `${name}.json`);
    this._mongoCol = null;
    this._ensureFile(initialData);
    this._load();
  }

  _ensureFile(defaultData = []) {
    if (!fs.existsSync(this.filePath)) {
      try {
        fs.writeFileSync(this.filePath, JSON.stringify(defaultData, null, 2), 'utf-8');
      } catch (e) {}
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
      // Silent backup persist
    }
  }

  async initMongo(mongoDb) {
    if (!mongoDb) return;
    try {
      this._mongoCol = mongoDb.collection(this.mongoName);
      const docs = await this._mongoCol.find({}).toArray();
      if (docs && docs.length > 0) {
        this.length = 0;
        super.push(...docs);
        this._persist();
        console.log(`[MongoDB] Connected & loaded ${docs.length} records for '${this.name}' (${this.mongoName})`);
      } else if (this.length > 0) {
        const cleanDocs = Array.from(this).map(d => ({
          ...d,
          _id: d._id ? String(d._id) : (d.id ? String(d.id) : uuidv4()),
          id: d.id ? String(d.id) : (d._id ? String(d._id) : uuidv4())
        }));
        await this._mongoCol.insertMany(cleanDocs);
        console.log(`[MongoDB] Initialized '${this.name}' with ${cleanDocs.length} seed records into MongoDB Atlas`);
      }
    } catch (err) {
      console.warn(`[MongoDB] Sync warning for '${this.name}':`, err.message);
    }
  }

  async reloadFromMongo() {
    if (this._mongoCol) {
      try {
        const docs = await this._mongoCol.find({}).toArray();
        this.length = 0;
        super.push(...docs);
        this._persist();
        return docs;
      } catch (e) {
        console.warn(`[MongoDB] Reload error for '${this.name}':`, e.message);
      }
    }
    return Array.from(this);
  }

  // Override mutating Array methods
  push(...items) {
    const res = super.push(...items);
    this._persist();
    if (this._mongoCol && items.length > 0) {
      const docs = items.map(d => ({
        ...d,
        _id: d._id ? String(d._id) : (d.id ? String(d.id) : uuidv4()),
        id: d.id ? String(d.id) : (d._id ? String(d._id) : uuidv4()),
        updatedAt: d.updatedAt || new Date().toISOString()
      }));
      Promise.all(docs.map(doc => 
        this._mongoCol.updateOne(
          { $or: [{ _id: doc._id }, { id: doc.id }] },
          { $set: doc },
          { upsert: true }
        ).catch(() => {})
      )).catch(() => {});
    }
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

  async find(queryOrFn) {
    if (typeof queryOrFn === 'function') {
      return super.find(queryOrFn);
    }

    const query = queryOrFn || {};
    const cleanQuery = sanitizeQuery(query);

    if (this._mongoCol) {
      try {
        const docs = await this._mongoCol.find(cleanQuery).toArray();
        return docs;
      } catch (e) {}
    }

    const results = Array.from(this).filter(item => {
      for (const [key, val] of Object.entries(cleanQuery)) {
        if (val === undefined || val === null) continue;
        if (item[key] !== val) return false;
      }
      return true;
    });

    return results;
  }

  async findOne(query = {}) {
    const items = Array.from(this);
    if (typeof query === 'function') {
      return items.find(query) || null;
    }
    const cleanQuery = sanitizeQuery(query);
    if (this._mongoCol) {
      try {
        const liveDoc = await this._mongoCol.findOne(cleanQuery);
        if (liveDoc) return liveDoc;
      } catch (e) {}
    }
    return items.find(item => {
      for (const [key, val] of Object.entries(cleanQuery)) {
        if (item[key] !== val) return false;
      }
      return true;
    }) || null;
  }

  async findById(id) {
    if (!id) return null;
    const strId = String(id);
    if (this._mongoCol) {
      try {
        const liveDoc = await this._mongoCol.findOne({
          $or: [{ _id: id }, { id: id }, { _id: strId }, { id: strId }]
        });
        if (liveDoc) return liveDoc;
      } catch (e) {}
    }
    return Array.from(this).find(item => String(item._id || item.id) === strId) || null;
  }

  async insertOne(doc) {
    const genId = doc._id ? String(doc._id) : (doc.id ? String(doc.id) : uuidv4());
    const newDoc = {
      _id: genId,
      id: genId,
      ...doc,
      createdAt: doc.createdAt || new Date().toISOString(),
      updatedAt: doc.updatedAt || new Date().toISOString()
    };
    newDoc._id = String(newDoc._id);
    newDoc.id = String(newDoc.id);

    const existingIdx = this.findIndex(i => String(i._id) === newDoc._id || String(i.id) === newDoc.id);
    if (existingIdx >= 0) {
      this[existingIdx] = newDoc;
    } else {
      super.push(newDoc);
    }
    this._persist();

    if (this._mongoCol) {
      try {
        await this._mongoCol.updateOne(
          { $or: [{ _id: newDoc._id }, { id: newDoc.id }] },
          { $set: newDoc },
          { upsert: true }
        );
      } catch (err) {
        console.error(`[MongoDB] Error inserting into ${this.name}:`, err.message);
      }
    }

    return newDoc;
  }

  async insertMany(docs) {
    const newDocs = docs.map(doc => {
      const generated = doc._id ? String(doc._id) : (doc.id ? String(doc.id) : uuidv4());
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

    if (this._mongoCol && newDocs.length > 0) {
      try {
        await Promise.all(newDocs.map(d =>
          this._mongoCol.updateOne(
            { $or: [{ _id: d._id }, { id: d.id }] },
            { $set: d },
            { upsert: true }
          )
        ));
      } catch (err) {
        console.error(`[MongoDB] Error insertMany into ${this.name}:`, err.message);
      }
    }

    return newDocs;
  }

  async updateOne(query, update) {
    const index = Array.from(this).findIndex(item => {
      for (const [key, val] of Object.entries(query)) {
        if (item[key] !== val) return false;
      }
      return true;
    });

    const patch = update.$set ? update.$set : update;
    let updated = null;
    if (index !== -1) {
      updated = {
        ...this[index],
        ...patch,
        updatedAt: new Date().toISOString()
      };
      this[index] = updated;
      this._persist();
    }

    if (this._mongoCol) {
      try {
        const cleanQuery = sanitizeQuery(query);
        await this._mongoCol.updateOne(cleanQuery, { $set: { ...patch, updatedAt: new Date().toISOString() } });
      } catch (err) {
        console.error(`[MongoDB] Error updateOne in ${this.name}:`, err.message);
      }
    }

    return updated;
  }

  async findByIdAndUpdate(id, update) {
    const strId = String(id);
    const index = Array.from(this).findIndex(item => String(item._id || item.id) === strId);

    const patch = update.$set ? update.$set : update;
    let updated = null;
    if (index !== -1) {
      updated = {
        ...this[index],
        ...patch,
        updatedAt: new Date().toISOString()
      };
      this[index] = updated;
      this._persist();
    }

    if (this._mongoCol) {
      try {
        await this._mongoCol.updateOne(
          { $or: [{ _id: id }, { id: id }, { _id: strId }, { id: strId }] },
          { $set: { ...patch, updatedAt: new Date().toISOString() } }
        );
      } catch (err) {
        console.error(`[MongoDB] Error findByIdAndUpdate in ${this.name}:`, err.message);
      }
    }

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
      this._persist();
    }

    if (this._mongoCol) {
      try {
        const cleanQuery = sanitizeQuery(query);
        await this._mongoCol.deleteOne(cleanQuery);
      } catch (err) {
        console.error(`[MongoDB] Error deleteOne in ${this.name}:`, err.message);
      }
    }

    return { deletedCount: index !== -1 ? 1 : 0 };
  }

  async count(query = {}) {
    const items = await this.find(query);
    return items.length;
  }

  async clear() {
    this.length = 0;
    this._persist();
    if (this._mongoCol) {
      try {
        await this._mongoCol.deleteMany({});
      } catch (e) {}
    }
  }
}

// Instantiate database collections mapped to MongoDB Atlas collections
const usersCollection = new Collection('users', [], 'users');
const statesCollection = new Collection('states', seed.hierarchy?.states || [], 'states');
const districtsCollection = new Collection('districts', [], 'districts');
const divisionsCollection = new Collection('divisions', [], 'divisions');
const pincodesCollection = new Collection('pincodes', [], 'pincodes');
const vendorsCollection = new Collection('vendors', seed.vendors || [], 'vendors');
const auditLogsCollection = new Collection('audit_logs', [], 'auditlogs');
const shopVisitsCollection = new Collection('shop_visits', [], 'fieldvisits');
const submittedReportsCollection = new Collection('submitted_reports', [], 'reports');
const qcIssuesCollection = new Collection('qc_issues', [], 'qc_issues');
const qcTasksCollection = new Collection('qc_tasks', [], 'tasks');
const agentsCollection = new Collection('agents', seed.agents || [], 'agents');
const notificationsCollection = new Collection('notifications', [], 'notifications');
const customersCollection = new Collection('customers', seed.customers || [], 'customers');
const vendorPaymentsCollection = new Collection('payments', seed.vendorPayments || [], 'payments');
const ordersCollection = new Collection('orders', seed.orders || [], 'orders');
const bookingsCollection = new Collection('bookings', seed.bookings || [], 'bookings');
const jobsCollection = new Collection('jobs', seed.jobs || [], 'jobs');
const techniciansCollection = new Collection('technicians', seed.technicians || [], 'technicians');
const executivesCollection = new Collection('executives', seed.executives || [], 'executives');
const supportTeamCollection = new Collection('support_team', seed.supportTeam || [], 'supportteams');
const agentPaymentsCollection = new Collection('agent_payments', seed.agentPayments || [], 'payrollrecords');
const agentActivitiesCollection = new Collection('agent_activities', seed.agentActivities || [], 'agentactivities');
const kycRecordsCollection = new Collection('kyc_records', seed.kycRecords || [], 'kyc_records');
const qualityCheckRecordsCollection = new Collection('quality_check_records', seed.qualityCheckRecords || [], 'quality_check_records');
const managersCollection = new Collection('managers', [], 'managers');

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
  users: usersCollection,
  states: statesCollection,
  districts: districtsCollection,
  divisions: divisionsCollection,
  pincodes: pincodesCollection,
  vendors: vendorsCollection,
  auditLogs: auditLogsCollection,
  shopVisits: shopVisitsCollection,
  submittedReports: submittedReportsCollection,
  qcIssues: qcIssuesCollection,
  qcTasks: qcTasksCollection,
  notifications: notificationsCollection,
  customers: customersCollection,
  vendorPayments: vendorPaymentsCollection,
  orders: ordersCollection,
  bookings: bookingsCollection,
  jobs: jobsCollection,
  technicians: techniciansCollection,
  executives: executivesCollection,
  supportTeam: supportTeamCollection,
  agents: agentsCollection,
  agentPayments: agentPaymentsCollection,
  agentActivities: agentActivitiesCollection,
  kycRecords: kycRecordsCollection,
  qualityCheckRecords: qualityCheckRecordsCollection,
  managers: managersCollection,

  get admins() {
    return Array.from(usersCollection).filter(u => 
      u.role === 'State Admin' || 
      u.role === 'District Admin' || 
      u.role === 'Divisional Admin' || 
      u.role === 'Division Admin' ||
      u.role === 'Pincode Admin' ||
      u.role === 'Super Admin' ||
      u.role === 'QC Team' ||
      u.role === 'qc_team'
    );
  },

  hierarchy: JSON.parse(JSON.stringify(seed.hierarchy)),
  pincodeDetails: JSON.parse(JSON.stringify(seed.pincodeDetails))
};

// Build hierarchy exclusively from Admin Pincode Management collections (single source of truth)
function syncHierarchyFromDatabase() {
  const rawStates = Array.from(statesCollection).filter(s => (s.status || 'Active').toLowerCase() === 'active');
  const rawDistricts = Array.from(districtsCollection).filter(d => (d.status || 'Active').toLowerCase() === 'active');
  const rawDivisions = Array.from(divisionsCollection).filter(v => (v.status || 'Active').toLowerCase() === 'active');
  const rawPincodes = Array.from(pincodesCollection).filter(p => (p.status || 'Active').toLowerCase() === 'active');

  db.hierarchy = {
    states: rawStates.map(s => {
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
        stateId: s.stateId || sId,
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
    })
  };
}

syncHierarchyFromDatabase();

/**
 * Connect all collections to MongoDB Atlas
 */
let initPromise = null;
function initDatabase() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const mongoDb = await getMongoDb();
      if (!mongoDb) {
        console.warn('[Database] MongoDB Atlas not available, operating in resilient local mode.');
        return false;
      }

      const collections = [
        usersCollection,
        statesCollection,
        districtsCollection,
        divisionsCollection,
        pincodesCollection,
        vendorsCollection,
        auditLogsCollection,
        shopVisitsCollection,
        submittedReportsCollection,
        qcIssuesCollection,
        qcTasksCollection,
        agentsCollection,
        notificationsCollection,
        customersCollection,
        vendorPaymentsCollection,
        ordersCollection,
        bookingsCollection,
        jobsCollection,
        techniciansCollection,
        executivesCollection,
        supportTeamCollection,
        agentPaymentsCollection,
        agentActivitiesCollection,
        kycRecordsCollection,
        qualityCheckRecordsCollection,
        managersCollection
      ];

      await Promise.all(collections.map(col => col.initMongo(mongoDb)));

      initUsers();
      syncHierarchyFromDatabase();
      console.log('✅ [Database] All collections connected to MongoDB Atlas as single source of truth.');
      return true;
    } catch (err) {
      console.error('[Database] MongoDB Atlas initialization failed:', err.message);
      return false;
    }
  })();
  return initPromise;
}

// Trigger database initialization
initDatabase().catch(e => console.warn('[Database] Auto-init:', e.message));

/**
 * Enhanced location filter supporting both Sub-Admin roles and Field Manager roles.
 * Matches by geographic name ('Tamil Nadu', 'Krishnagiri') or ID ('stateId', 'districtId').
 * Resolves item coordinates through centralized Pincode database lookup.
 */
function filterByLocation(items, user) {
  if (!items || !Array.isArray(items)) return [];
  if (!user) return [];

  const rawRole = user.role || '';
  const role = rawRole.toLowerCase().replace(/_/g, ' ');
  const isSuper = role.includes('super admin') || role === 'admin';
  if (isSuper) return items;

  const { state, district, division, pincode, stateId, districtId, divisionId, pincodeId } = user;
  const userState = (state || '').trim().toLowerCase();
  const userDistrict = (district || '').trim().toLowerCase();
  const userDivision = (division || '').trim().toLowerCase();
  const userPincode = (pincode || '').trim();

  // Index pincodes for fast geographic resolution
  const pinLookup = new Map();
  Array.from(pincodesCollection).forEach(p => {
    const code = String(p.code || p.pincode || '').trim();
    if (code) {
      pinLookup.set(code, {
        state: (p.state || '').trim().toLowerCase(),
        district: (p.district || '').trim().toLowerCase(),
        division: (p.division || '').trim().toLowerCase()
      });
    }
  });

  return items.filter(item => {
    let iState = (item.state || '').trim().toLowerCase();
    let iDist = (item.district || '').trim().toLowerCase();
    let iDiv = (item.division || '').trim().toLowerCase();
    const iPin = String(item.pincode || item.pincodeCode || '').trim();

    if (iPin && pinLookup.has(iPin)) {
      const pinGeo = pinLookup.get(iPin);
      if (!iState && pinGeo.state) iState = pinGeo.state;
      if (!iDist && pinGeo.district) iDist = pinGeo.district;
      if (!iDiv && pinGeo.division) iDiv = pinGeo.division;
    }

    // Pincode level user
    if (role.includes('pincode')) {
      if (userPincode && iPin && iPin === userPincode) return true;
      if (pincodeId && item.pincodeId && String(item.pincodeId) === String(pincodeId)) return true;
      return false;
    }

    // Division level user
    if (role.includes('division') || role.includes('divisional')) {
      const matchDiv = !userDivision || iDiv === userDivision;
      const matchDist = !userDistrict || iDist === userDistrict;
      const matchState = !userState || userState === 'all india' || iState === userState;
      return matchDiv && matchDist && matchState;
    }

    // District level user
    if (role.includes('district')) {
      const matchDist = !userDistrict || iDist === userDistrict;
      const matchState = !userState || userState === 'all india' || iState === userState;
      return matchDist && matchState;
    }

    // State level user
    if (role.includes('state')) {
      if (!userState || userState === 'all india') return true;
      return iState === userState || (stateId && String(item.stateId) === String(stateId));
    }

    return false;
  });
}

module.exports = {
  db,
  Collection,
  filterByLocation,
  initDatabase,
  syncHierarchyFromDatabase,
  syncHierarchyFromUsers: syncHierarchyFromDatabase
};
