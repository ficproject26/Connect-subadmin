const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { v4: uuidv4 } = require('uuid');
const { getMongoDb } = require('./mongo');
const eventPublisher = require('../events/eventPublisher');

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
 * Collection represents a MongoDB Atlas-driven data store.
 * MongoDB Atlas is the absolute single source of truth.
 * The in-memory array maintains a live synchronized reflection of MongoDB records
 * to guarantee backwards compatibility with synchronous array methods (find, filter, map, etc.)
 * across all existing controllers and workflows.
 */
class Collection extends Array {
  constructor(name, initialData = [], mongoCollectionName = null) {
    super();
    this.name = name;
    this.mongoName = mongoCollectionName || name;
    this._mongoCol = null;
    this._isReady = false;
  }

  async initMongo(mongoDb) {
    if (!mongoDb) {
      throw new Error(`MongoDB client instance is required to initialize collection '${this.name}'`);
    }
    this._mongoCol = mongoDb.collection(this.mongoName);
    const projection = (this.name === 'users' || this.name === 'agents') ? {
      kyc: 0,
      kycDocs: 0,
      documents: 0,
      aadhaarImage: 0,
      panImage: 0,
      selfie: 0
    } : {};
    const docs = await this._mongoCol.find({}, { projection }).toArray();
    this.length = 0;
    if (docs && docs.length > 0) {
      super.push(...docs);
      console.log(`[MongoDB] Loaded ${docs.length} records for '${this.name}' (${this.mongoName})`);
    } else {
      console.log(`[MongoDB] Connected to empty collection '${this.name}' (${this.mongoName})`);
    }
    this._isReady = true;
  }

  async reloadFromMongo(force = false) {
    if (this._mongoCol) {
      const now = Date.now();
      // Throttle reloads to at most once every 60 seconds per collection to eliminate redundant network roundtrips
      if (!force && this._lastReload && (now - this._lastReload < 60000)) {
        return Array.from(this);
      }
      this._lastReload = now;
      const projection = (this.name === 'users' || this.name === 'agents') ? {
        kyc: 0,
        kycDocs: 0,
        documents: 0,
        aadhaarImage: 0,
        panImage: 0,
        selfie: 0
      } : {};
      const docs = await this._mongoCol.find({}, { projection }).toArray();
      this.length = 0;
      if (docs && docs.length > 0) {
        super.push(...docs);
      }
      return docs;
    }
    return Array.from(this);
  }

  push(...items) {
    const res = super.push(...items);
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
        )
      )).catch(err => {
        console.error(`[MongoDB] Async push error on '${this.name}':`, err.message);
      });
    }
    if (this._isReady && items.length > 0) {
      if (items.length === 1) {
        eventPublisher.publishEntityEvent(this.name, 'created', items[0], items[0]._id || items[0].id).catch(() => {});
      } else {
        eventPublisher.publishBatchEvent(this.name, 'batch_created', items).catch(() => {});
      }
    }
    return res;
  }

  unshift(...items) {
    return this.push(...items);
  }

  splice(...args) {
    return super.splice(...args);
  }

  async find(queryOrFn) {
    if (typeof queryOrFn === 'function') {
      return super.find(queryOrFn);
    }

    const cleanQuery = sanitizeQuery(queryOrFn || {});
    if (this._mongoCol) {
      return await this._mongoCol.find(cleanQuery).toArray();
    }

    return Array.from(this).filter(item => {
      for (const [key, val] of Object.entries(cleanQuery)) {
        if (val === undefined || val === null) continue;
        if (item[key] !== val) return false;
      }
      return true;
    });
  }

  async findOne(query = {}) {
    if (typeof query === 'function') {
      return Array.from(this).find(query) || null;
    }
    const cleanQuery = sanitizeQuery(query);
    if (this._mongoCol) {
      return await this._mongoCol.findOne(cleanQuery);
    }
    return Array.from(this).find(item => {
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
      return await this._mongoCol.findOne({
        $or: [{ _id: id }, { id: id }, { _id: strId }, { id: strId }]
      });
    }
    return Array.from(this).find(item => String(item._id || item.id) === strId) || null;
  }

  async insertOne(doc) {
    if (!this._mongoCol) {
      throw new Error(`MongoDB collection '${this.mongoName}' is not connected.`);
    }
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

    // Persist to MongoDB as single source of truth
    await this._mongoCol.updateOne(
      { $or: [{ _id: newDoc._id }, { id: newDoc.id }] },
      { $set: newDoc },
      { upsert: true }
    );

    // Update in-memory mirror only after MongoDB write succeeds
    const existingIdx = this.findIndex(i => String(i._id) === newDoc._id || String(i.id) === newDoc.id);
    if (existingIdx >= 0) {
      this[existingIdx] = newDoc;
    } else {
      super.push(newDoc);
    }

    if (this._isReady) {
      eventPublisher.publishEntityEvent(this.name, 'created', newDoc, newDoc._id).catch(() => {});
      if (['states', 'districts', 'divisions', 'pincodes'].includes(this.name)) {
        if (typeof syncHierarchyFromDatabase === 'function') syncHierarchyFromDatabase();
        eventPublisher.publishEntityEvent('territory', 'updated', { timestamp: new Date().toISOString() }).catch(() => {});
      }
    }

    return newDoc;
  }

  async create(doc) {
    return this.insertOne(doc);
  }

  async save(doc) {
    return this.insertOne(doc);
  }

  async insertMany(docs) {
    if (!this._mongoCol) {
      throw new Error(`MongoDB collection '${this.mongoName}' is not connected.`);
    }
    if (!docs || docs.length === 0) return [];
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

    await Promise.all(newDocs.map(d =>
      this._mongoCol.updateOne(
        { $or: [{ _id: d._id }, { id: d.id }] },
        { $set: d },
        { upsert: true }
      )
    ));

    super.push(...newDocs);

    if (this._isReady && newDocs.length > 0) {
      eventPublisher.publishBatchEvent(this.name, 'batch_created', newDocs).catch(() => {});
      if (['states', 'districts', 'divisions', 'pincodes'].includes(this.name)) {
        if (typeof syncHierarchyFromDatabase === 'function') syncHierarchyFromDatabase();
        eventPublisher.publishEntityEvent('territory', 'updated', { timestamp: new Date().toISOString() }).catch(() => {});
      }
    }

    return newDocs;
  }

  async updateOne(query, update) {
    if (!this._mongoCol) {
      throw new Error(`MongoDB collection '${this.mongoName}' is not connected.`);
    }
    const cleanQuery = sanitizeQuery(query);
    const patch = update.$set ? update.$set : update;
    const updatedAt = new Date().toISOString();

    await this._mongoCol.updateOne(cleanQuery, { $set: { ...patch, updatedAt } });
    const updated = await this._mongoCol.findOne(cleanQuery);

    if (updated) {
      const index = Array.from(this).findIndex(item => {
        for (const [key, val] of Object.entries(query)) {
          if (item[key] !== val) return false;
        }
        return true;
      });
      if (index !== -1) {
        this[index] = updated;
      } else {
        super.push(updated);
      }

      if (this._isReady) {
        eventPublisher.publishEntityEvent(this.name, 'updated', updated, updated._id || updated.id).catch(() => {});
        if (['states', 'districts', 'divisions', 'pincodes'].includes(this.name)) {
          if (typeof syncHierarchyFromDatabase === 'function') syncHierarchyFromDatabase();
          eventPublisher.publishEntityEvent('territory', 'updated', { timestamp: new Date().toISOString() }).catch(() => {});
        }
      }
    }

    return updated;
  }

  async findByIdAndUpdate(id, update) {
    if (!this._mongoCol) {
      throw new Error(`MongoDB collection '${this.mongoName}' is not connected.`);
    }
    const strId = String(id);
    const filter = { $or: [{ _id: id }, { id: id }, { _id: strId }, { id: strId }] };
    const patch = update.$set ? update.$set : update;
    const updatedAt = new Date().toISOString();

    await this._mongoCol.updateOne(filter, { $set: { ...patch, updatedAt } });
    const updated = await this._mongoCol.findOne(filter);

    if (updated) {
      const index = Array.from(this).findIndex(item => String(item._id || item.id) === strId);
      if (index !== -1) {
        this[index] = updated;
      } else {
        super.push(updated);
      }

      if (this._isReady) {
        eventPublisher.publishEntityEvent(this.name, 'updated', updated, strId).catch(() => {});
        if (['states', 'districts', 'divisions', 'pincodes'].includes(this.name)) {
          if (typeof syncHierarchyFromDatabase === 'function') syncHierarchyFromDatabase();
          eventPublisher.publishEntityEvent('territory', 'updated', { timestamp: new Date().toISOString() }).catch(() => {});
        }
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
    if (!this._mongoCol) {
      throw new Error(`MongoDB collection '${this.mongoName}' is not connected.`);
    }
    const cleanQuery = sanitizeQuery(query);
    const res = await this._mongoCol.deleteOne(cleanQuery);

    const index = Array.from(this).findIndex(item => {
      for (const [key, val] of Object.entries(query)) {
        if (item[key] !== val) return false;
      }
      return true;
    });

    if (index !== -1) {
      this.splice(index, 1);
    }

    if (this._isReady) {
      const deletedId = query.id || query._id;
      eventPublisher.publishEntityEvent(this.name, 'deleted', { id: deletedId, ...query }, deletedId).catch(() => {});
      if (['states', 'districts', 'divisions', 'pincodes'].includes(this.name)) {
        if (typeof syncHierarchyFromDatabase === 'function') syncHierarchyFromDatabase();
        eventPublisher.publishEntityEvent('territory', 'updated', { timestamp: new Date().toISOString() }).catch(() => {});
      }
    }

    return { deletedCount: res.deletedCount || (index !== -1 ? 1 : 0) };
  }

  async delete(query) {
    return this.deleteOne(query);
  }

  async deleteMany(query) {
    if (!this._mongoCol) {
      throw new Error(`MongoDB collection '${this.mongoName}' is not connected.`);
    }
    const cleanQuery = sanitizeQuery(query);
    const res = await this._mongoCol.deleteMany(cleanQuery);
    await this.reloadFromMongo();
    return { deletedCount: res.deletedCount };
  }

  async count(query = {}) {
    if (this._mongoCol) {
      return await this._mongoCol.countDocuments(sanitizeQuery(query));
    }
    const items = await this.find(query);
    return items.length;
  }

  async clear() {
    this.length = 0;
    if (this._mongoCol) {
      await this._mongoCol.deleteMany({});
    }
  }
}

// Instantiate database collections mapped directly to MongoDB Atlas collections (zero mock/seed data)
const usersCollection = new Collection('users', [], 'users');
const statesCollection = new Collection('states', [], 'states');
const districtsCollection = new Collection('districts', [], 'districts');
const divisionsCollection = new Collection('divisions', [], 'divisions');
const pincodesCollection = new Collection('pincodes', [], 'pincodes');
const vendorsCollection = new Collection('vendors', [], 'vendors');
const auditLogsCollection = new Collection('audit_logs', [], 'auditlogs');
const shopVisitsCollection = new Collection('shop_visits', [], 'fieldvisits');
const submittedReportsCollection = new Collection('submitted_reports', [], 'reports');
const qcIssuesCollection = new Collection('qc_issues', [], 'qc_issues');
const qcTasksCollection = new Collection('qc_tasks', [], 'tasks');
const agentsCollection = new Collection('agents', [], 'agents');
const notificationsCollection = new Collection('notifications', [], 'notifications');
const customersCollection = new Collection('customers', [], 'customers');
const vendorPaymentsCollection = new Collection('payments', [], 'payments');
const ordersCollection = new Collection('orders', [], 'orders');
const bookingsCollection = new Collection('bookings', [], 'bookings');
const jobsCollection = new Collection('jobs', [], 'jobs');
const techniciansCollection = new Collection('technicians', [], 'technicians');
const executivesCollection = new Collection('executives', [], 'executives');
const supportTeamCollection = new Collection('support_team', [], 'supportteams');
const agentPaymentsCollection = new Collection('agent_payments', [], 'payrollrecords');
const agentActivitiesCollection = new Collection('agent_activities', [], 'agentactivities');
const kycRecordsCollection = new Collection('kyc_records', [], 'kyc_records');
const qualityCheckRecordsCollection = new Collection('quality_check_records', [], 'quality_check_records');
const managersCollection = new Collection('managers', [], 'managers');
const cardholdersCollection = new Collection('cardholders', [], 'cardholders');
const membershipOrdersCollection = new Collection('membership_orders', [], 'membership_orders');
const deliveryPartnersCollection = new Collection('delivery_partners', [], 'delivery_partners');
const subscriptionsCollection = new Collection('subscriptions', [], 'subscriptions');
const subscriptionPaymentsCollection = new Collection('subscription_payments', [], 'subscriptionpayments');
const deliveryStatusHistoryCollection = new Collection('delivery_status_history', [], 'delivery_status_history');
const settlementsCollection = new Collection('settlements', [], 'settlements');
const productsCollection = new Collection('products', [], 'products');
const jobappliedsCollection = new Collection('jobapplieds', [], 'jobapplieds');

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
  cardholders: cardholdersCollection,
  membershipOrders: membershipOrdersCollection,
  deliveryPartners: deliveryPartnersCollection,
  subscriptions: subscriptionsCollection,
  subscriptionPayments: subscriptionPaymentsCollection,
  deliveryStatusHistory: deliveryStatusHistoryCollection,
  settlements: settlementsCollection,
  products: productsCollection,
  jobapplieds: jobappliedsCollection,

  get admins() {
    return Array.from(usersCollection).filter(u => {
      if (!u) return false;
      const r = String(u.role || '').toLowerCase().trim();
      const ar = String(u.adminRole || '').toLowerCase().trim();
      const al = String(u.adminLevel || '').toLowerCase().trim();
      return (
        r.includes('admin') ||
        ar.includes('admin') ||
        al.includes('state') ||
        al.includes('district') ||
        al.includes('division') ||
        al.includes('pincode') ||
        al.includes('main') ||
        al.includes('super') ||
        r === 'qc team' ||
        r === 'qc_team'
      );
    });
  },

  hierarchy: { states: [] },
  pincodeDetails: {}
};

// Build hierarchy exclusively from Admin Pincode Management collections (single source of truth)
function syncHierarchyFromDatabase() {
  const rawStates = Array.from(statesCollection).filter(s => (s.status || 'Active').toLowerCase() === 'active');
  const rawDistricts = Array.from(districtsCollection).filter(d => (d.status || 'Active').toLowerCase() === 'active');
  const rawDivisions = Array.from(divisionsCollection).filter(v => (v.status || 'Active').toLowerCase() === 'active');
  const rawPincodes = Array.from(pincodesCollection).filter(p => (p.status || 'Active').toLowerCase() === 'active');

  const pinByDivision = new Map();
  for (const p of rawPincodes) {
    const kId = String(p.divisionId || p.division_id || '');
    const kName = (p.division || '').toLowerCase().trim();
    if (kId) {
      if (!pinByDivision.has(kId)) pinByDivision.set(kId, []);
      pinByDivision.get(kId).push(p);
    }
    if (kName && kName !== kId) {
      if (!pinByDivision.has(kName)) pinByDivision.set(kName, []);
      pinByDivision.get(kName).push(p);
    }
  }

  const divByDistrict = new Map();
  for (const v of rawDivisions) {
    const kId = String(v.districtId || v.district_id || '');
    const kName = (v.district || '').toLowerCase().trim();
    if (kId) {
      if (!divByDistrict.has(kId)) divByDistrict.set(kId, []);
      divByDistrict.get(kId).push(v);
    }
    if (kName && kName !== kId) {
      if (!divByDistrict.has(kName)) divByDistrict.set(kName, []);
      divByDistrict.get(kName).push(v);
    }
  }

  const distByState = new Map();
  for (const d of rawDistricts) {
    const kId = String(d.stateId || d.state_id || '');
    const kName = (d.state || '').toLowerCase().trim();
    if (kId) {
      if (!distByState.has(kId)) distByState.set(kId, []);
      distByState.get(kId).push(d);
    }
    if (kName && kName !== kId) {
      if (!distByState.has(kName)) distByState.set(kName, []);
      distByState.get(kName).push(d);
    }
  }

  db.hierarchy = {
    states: rawStates.map(s => {
      const sId = String(s._id || s.id || s.stateId);
      const sName = (s.name || '').trim();

      const distList = distByState.get(sId) || distByState.get(sName.toLowerCase()) || [];

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

          const divList = divByDistrict.get(dId) || divByDistrict.get(dName.toLowerCase()) || [];

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

              const pinList = pinByDivision.get(vId) || pinByDivision.get(vName.toLowerCase()) || [];

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

/**
 * Connect all collections to MongoDB Atlas as the single source of truth
 */
let initPromise = null;
function initDatabase() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const mongoDb = await getMongoDb();
      if (!mongoDb) {
        throw new Error('Failed to obtain MongoDB Atlas database instance.');
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
        managersCollection,
        cardholdersCollection,
        membershipOrdersCollection,
        deliveryPartnersCollection,
        subscriptionsCollection,
        subscriptionPaymentsCollection,
        deliveryStatusHistoryCollection,
        settlementsCollection,
        productsCollection,
        jobappliedsCollection
      ];

      await Promise.all(collections.map(col => col.initMongo(mongoDb)));

      syncHierarchyFromDatabase();

      // Ensure performance indexes in MongoDB Atlas asynchronously (non-blocking)
      Promise.allSettled([
        mongoDb.collection('users').createIndex({ email: 1 }),
        mongoDb.collection('users').createIndex({ role: 1, status: 1 }),
        mongoDb.collection('vendors').createIndex({ status: 1, kycStatus: 1 }),
        mongoDb.collection('vendors').createIndex({ pincode: 1 }),
        mongoDb.collection('vendors').createIndex({ category: 1, status: 1 }),
        mongoDb.collection('orders').createIndex({ status: 1, createdAt: -1 }),
        mongoDb.collection('orders').createIndex({ category: 1, status: 1 }),
        mongoDb.collection('orders').createIndex({ type: 1, status: 1 }),
        mongoDb.collection('orders').createIndex({ pincode: 1 }),
        mongoDb.collection('bookings').createIndex({ status: 1, createdAt: -1 }),
        mongoDb.collection('bookings').createIndex({ category: 1, status: 1 }),
        mongoDb.collection('jobs').createIndex({ status: 1, createdAt: -1 }),
        mongoDb.collection('customers').createIndex({ phone: 1, email: 1 }),
        mongoDb.collection('cardholders').createIndex({ phone: 1, email: 1, cardNumber: 1 }),
        mongoDb.collection('delivery_status_history').createIndex({ order_id: 1 }),
        mongoDb.collection('delivery_status_history').createIndex({ order_number: 1 }),
        mongoDb.collection('pincodes').createIndex({ code: 1 }),
        mongoDb.collection('pincodes').createIndex({ divisionId: 1, districtId: 1 }),
        mongoDb.collection('districts').createIndex({ stateId: 1 }),
        mongoDb.collection('divisions').createIndex({ districtId: 1 })
      ]).then(() => {
        console.log('⚡ [Database] Performance indexes verified in MongoDB Atlas.');
      }).catch(() => {});

      console.log('✅ [Database] All collections connected to MongoDB Atlas as single source of truth.');
      return true;
    } catch (err) {
      initPromise = null;
      console.error('[Database] MongoDB Atlas initialization error:', err.message);
      throw err;
    }
  })();
  return initPromise;
}

// Trigger database initialization
initDatabase().catch(e => console.error('[Database] Auto-init error:', e.message));

/**
 * Normalize division names for reliable comparison (e.g. "Hosur Division" -> "hosur")
 */
function normDiv(name) {
  if (!name) return '';
  return String(name).toLowerCase().replace(/\s+division$/i, '').trim();
}

/**
 * Static & Dynamic postal directory for high-speed coordinate resolution
 */
const KNOWN_PINCODES = {
  '641666': { state: 'tamil nadu', district: 'tirupur', division: 'palladam' },
  '635305': { state: 'tamil nadu', district: 'dharmapuri', division: 'harur' },
  '635002': { state: 'tamil nadu', district: 'krishnagiri', division: 'krishnagiri' },
  '635001': { state: 'tamil nadu', district: 'krishnagiri', division: 'krishnagiri' },
  '635109': { state: 'tamil nadu', district: 'krishnagiri', division: 'hosur' },
  '635110': { state: 'tamil nadu', district: 'krishnagiri', division: 'hosur' },
  '636112': { state: 'tamil nadu', district: 'salem', division: 'attur' },
  '636114': { state: 'tamil nadu', district: 'salem', division: 'attur' },
  '636001': { state: 'tamil nadu', district: 'salem', division: 'salem north' },
  '636002': { state: 'tamil nadu', district: 'salem', division: 'salem north' },
  '638001': { state: 'tamil nadu', district: 'erode', division: 'erode' },
  '638103': { state: 'tamil nadu', district: 'tirupur', division: 'avinasi' },
  '560068': { state: 'karnataka', district: 'bengaluru urban', division: 'bengaluru south' },
  '560072': { state: 'karnataka', district: 'bengaluru urban', division: 'bengaluru south' },
  '560087': { state: 'karnataka', district: 'bengaluru urban', division: 'bengaluru south' },
  '560034': { state: 'karnataka', district: 'bengaluru urban', division: 'bengaluru south' },
  '680001': { state: 'kerala', district: 'thrissur', division: 'thrissur' },
  '680004': { state: 'kerala', district: 'thrissur', division: 'thrissur west' },
  '680618': { state: 'kerala', district: 'thrissur', division: 'thrissur south' },
  '520001': { state: 'andhra pradesh', district: 'ntr district', division: 'vijayawada central' }
};

const DISTRICT_STATE_MAP = {
  'krishnagiri': 'tamil nadu',
  'dharmapuri': 'tamil nadu',
  'salem': 'tamil nadu',
  'erode': 'tamil nadu',
  'tirupur': 'tamil nadu',
  'tiruppur': 'tamil nadu',
  'dindigul': 'tamil nadu',
  'coimbatore': 'tamil nadu',
  'chennai': 'tamil nadu',
  'namakkal': 'tamil nadu',
  'madurai': 'tamil nadu',
  'thiruvarur': 'tamil nadu',
  'bengaluru urban': 'karnataka',
  'bangalore': 'karnataka',
  'thrissur': 'kerala',
  'ntr district': 'andhra pradesh',
  'vijayawada': 'andhra pradesh'
};

/**
 * Extract unified geographic coordinates from any entity
 */
function extractEntityGeo(item, pinLookup) {
  const t = item.territory || {};
  const addr0 = (item.addresses && item.addresses[0]) || {};
  const sc = item.scope || {};
  const meta = item.metadata || {};
  const deliv = item.deliveryAddress || {};

  let state = item.state || item.assignedState || t.state || addr0.state || item.vendorState || sc.state || meta.state || deliv.state || '';
  let district = item.district || item.assignedDistrict || t.district || item.vendorDistrict || addr0.district || addr0.city || item.city || sc.district || meta.district || deliv.district || '';
  let division = item.division || item.assignedDivision || t.division || addr0.division || sc.division || meta.division || deliv.division || '';
  let pincode = String(item.pincode || item.assignedPincode || item.pincodeCode || t.pincode || addr0.pincode || item.postalCode || sc.pincode || meta.pincode || deliv.pincode || '').trim();

  // If geo is missing and entityId is present, resolve from entity
  if (!pincode && !district && item.entityId) {
    if (item.entityType === 'vendor' && db.vendors) {
      const v = (db.vendors || []).find(x => String(x._id || x.id || x.vendorId) === String(item.entityId));
      if (v) {
        state = state || v.state;
        district = district || v.district || v.city;
        division = division || v.division;
        pincode = pincode || v.pincode;
      }
    } else if ((item.entityType === 'task' || item.entityType === 'qc_task') && db.qcTasks) {
      const tk = (db.qcTasks || []).find(x => String(x._id || x.id || x.taskId) === String(item.entityId));
      if (tk) {
        state = state || tk.state;
        district = district || tk.district;
        division = division || tk.division;
        pincode = pincode || tk.pincode;
      }
    } else if (item.entityType === 'order' && db.orders) {
      const od = (db.orders || []).find(x => String(x._id || x.id || x.orderId) === String(item.entityId));
      if (od) {
        state = state || od.state;
        district = district || od.district;
        division = division || od.division;
        pincode = pincode || od.pincode;
      }
    }
  }

  // If pincode missing, search address text
  const rawAddr = String(item.address || item.fullAddress || item.customer_address || addr0.address || '');
  if (!pincode && rawAddr) {
    const m = rawAddr.match(/\b\d{6}\b/);
    if (m) pincode = m[0];
  }

  // Lookup in dynamic + static pin table
  if (pincode) {
    const geo = pinLookup.get(pincode) || KNOWN_PINCODES[pincode];
    if (geo) {
      if (!state && geo.state) state = geo.state;
      if (!district && geo.district) district = geo.district;
      if (!division && geo.division) division = geo.division;
    }
  }

  // If stateId is provided but state name is missing
  if (!state && item.stateId) {
    const sId = String(item.stateId).toLowerCase();
    if (sId.includes('tn') || sId.includes('tamil')) state = 'tamil nadu';
    else if (sId.includes('ka') || sId.includes('karn')) state = 'karnataka';
    else if (sId.includes('kl') || sId.includes('ker')) state = 'kerala';
    else if (sId.includes('ap') || sId.includes('andhra')) state = 'andhra pradesh';
  }

  // If district is known but state missing
  const dNorm = String(district || '').trim().toLowerCase();
  if (dNorm && DISTRICT_STATE_MAP[dNorm] && (!state || state.toLowerCase() === 'karnataka' && dNorm === 'salem')) {
    state = DISTRICT_STATE_MAP[dNorm];
  }

  // String address fallback
  if (!state && rawAddr) {
    if (/tamil\s*nadu/i.test(rawAddr)) state = 'Tamil Nadu';
    else if (/karnataka/i.test(rawAddr)) state = 'Karnataka';
    else if (/kerala/i.test(rawAddr)) state = 'Kerala';
    else if (/andhra\s*pradesh/i.test(rawAddr)) state = 'Andhra Pradesh';
  }

  return {
    state: String(state || '').trim().toLowerCase(),
    district: String(district || '').trim().toLowerCase(),
    division: normDiv(division),
    pincode: String(pincode || '').trim(),
    stateId: item.stateId || null,
    districtId: item.districtId || null,
    divisionId: item.divisionId || null,
    pincodeId: item.pincodeId || null
  };
}

/**
 * Enhanced location filter supporting both Sub-Admin roles and Field Manager roles.
 * Matches by geographic coordinates and IDs.
 * Enforces strict non-leakage isolation across State, District, Division, and Pincode.
 */
function filterByLocation(items, user) {
  if (!items || !Array.isArray(items)) return [];
  if (!user) return [];

  const rawRole = user.role || '';
  const role = rawRole.toLowerCase().replace(/[_-]/g, ' ');
  const isSuper = role.includes('super admin') || role === 'admin' || role === 'superadmin' || rawRole === 'super-admin' || user.state === 'All India';
  if (isSuper) return items;

  const { state, district, division, pincode, stateId, districtId, divisionId, pincodeId } = user;
  const userState = (state || '').trim().toLowerCase();
  const userDistrict = (district || '').trim().toLowerCase();
  const userDivision = normDiv(division);
  const userPincode = (pincode || '').trim();

  // Index pincodes for fast geographic resolution
  const pinLookup = new Map();
  Array.from(pincodesCollection).forEach(p => {
    const code = String(p.code || p.pincode || '').trim();
    if (code) {
      pinLookup.set(code, {
        state: (p.state || '').trim().toLowerCase(),
        district: (p.district || '').trim().toLowerCase(),
        division: normDiv(p.division)
      });
    }
  });

  return items.filter(item => {
    const geo = extractEntityGeo(item, pinLookup);

    // ── 1. PINCODE ADMIN (Level 4) ──────────────────────────────────
    if (role.includes('pincode')) {
      if (userPincode && geo.pincode && geo.pincode === userPincode) return true;
      if (pincodeId && item.pincodeId && String(item.pincodeId) === String(pincodeId)) return true;
      return false;
    }

    // ── 2. DIVISION ADMIN (Level 3) ─────────────────────────────────
    if (role.includes('division') || role.includes('divisional')) {
      // Must match assigned State
      if (userState && userState !== 'all india' && geo.state && geo.state !== userState) return false;
      // Must match assigned District
      if (userDistrict && geo.district && geo.district !== userDistrict) return false;
      // Must match assigned Division
      if (userDivision && geo.division) {
        return geo.division === userDivision;
      }
      if (divisionId && item.divisionId && String(item.divisionId) === String(divisionId)) return true;
      return Boolean(userDivision && geo.division && geo.division === userDivision);
    }

    // ── 3. DISTRICT ADMIN (Level 2) ─────────────────────────────────
    if (role.includes('district')) {
      // Must match assigned State
      if (userState && userState !== 'all india' && geo.state && geo.state !== userState) return false;
      // Must match assigned District
      if (userDistrict && geo.district) {
        return geo.district === userDistrict;
      }
      if (districtId && item.districtId && String(item.districtId) === String(districtId)) return true;
      return Boolean(userDistrict && geo.district && geo.district === userDistrict);
    }

    // ── 4. STATE ADMIN (Level 1) ────────────────────────────────────
    if (role.includes('state')) {
      if (!userState || userState === 'all india') return true;
      // Reject cross-state records
      if (geo.state) {
        return geo.state === userState;
      }
      if (stateId && item.stateId && String(item.stateId) === String(stateId)) return true;
      return false;
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
