const { db, filterByLocation } = require('../config/db');
const { getComprehensiveVendorDirectory } = require('../utils/vendorDirectory');

function formatJobDate(dateVal) {
  if (!dateVal) return '-';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    return String(dateVal);
  }
}

function getPincodeDirectory() {
  const pinMap = new Map();
  Array.from(db.pincodes || []).forEach(p => {
    const code = String(p.code || p.pincode || '').trim();
    if (code && !pinMap.has(code)) {
      pinMap.set(code, {
        state: p.state || p.stateName || 'Tamil Nadu',
        district: p.district || p.districtName || '',
        division: p.division || p.divisionName || '',
        pincode: code,
        area: p.name || p.area || p.areaName || ''
      });
    }
  });
  return pinMap;
}

function normalizeJob(item, pinMap, vendorDir) {
  if (!item) return null;

  const jobId = String(item.id || item._id || item.jobId || item.order_number || '');
  const jobTitle = item.jobTitle || item.title || item.product_details || 'Job Opening';

  const customerAddress = item.customer_address || item.customerAddress || item.address || item.location || '';
  let pincode = String(item.pincode || item.deliveryPincode || '').trim();
  if (!pincode && customerAddress) {
    const pinMatch = customerAddress.match(/\b\d{6}\b/);
    if (pinMatch) pincode = pinMatch[0];
  }

  const pinGeo = (pinMap && pincode) ? (pinMap.get(pincode) || {}) : {};
  let state = item.state || item.stateName || pinGeo.state || '';
  let district = item.district || item.districtName || pinGeo.district || '';
  let division = item.division || item.divisionName || pinGeo.division || '';

  if (!district && customerAddress) {
    const addrUpper = customerAddress.toUpperCase();
    if (addrUpper.includes('SALEM')) district = 'Salem';
    else if (addrUpper.includes('ERODE')) district = 'Erode';
    else if (addrUpper.includes('KRISHNAGIRI')) district = 'Krishnagiri';
    else if (addrUpper.includes('DHARMAPURI')) district = 'Dharmapuri';
    else if (addrUpper.includes('NAMAKKAL')) district = 'Namakkal';
    else if (addrUpper.includes('TIRUPPUR') || addrUpper.includes('TIRUPUR')) district = 'Tiruppur';
    else if (addrUpper.includes('COIMBATORE')) district = 'Coimbatore';
    else if (addrUpper.includes('BANGALORE') || addrUpper.includes('BENGALURU')) district = 'Bengaluru Urban';
  }

  if (!division && customerAddress) {
    const addrUpper = customerAddress.toUpperCase();
    if (addrUpper.includes('THALAIVASAL')) division = 'Thalaivasal';
    else if (addrUpper.includes('ATTUR')) division = 'Attur';
    else if (addrUpper.includes('SALEM NORTH')) division = 'Salem North';
    else if (addrUpper.includes('HOSUR')) division = 'Hosur';
  }

  if (!state) {
    if (customerAddress.toLowerCase().includes('karnataka')) state = 'Karnataka';
    else if (customerAddress.toLowerCase().includes('tamil nadu')) state = 'Tamil Nadu';
  }

  // Vendor / Company Lookup via comprehensive vendor directory
  const vendorKey = String(item.vendor_id || item.vendorId || '').trim();
  let matchedVendor = null;
  if (vendorDir && vendorKey) {
    matchedVendor = vendorDir.get(vendorKey) ||
      vendorDir.get(`vendor_${vendorKey}`) ||
      vendorDir.get(vendorKey.replace(/^vendor_/, '')) ||
      null;
  }

  const vendorName = matchedVendor
    ? (matchedVendor.businessName || matchedVendor.name || matchedVendor.vendorBusinessName)
    : (item.vendorName || item.company || 'Enterprise Partner');

  const vendorId = matchedVendor
    ? (matchedVendor._id || matchedVendor.id || matchedVendor.vendorId)
    : (vendorKey || 'Not provided');

  const vendorState = matchedVendor?.state || '';
  const vendorDistrict = matchedVendor?.district || '';
  const vendorDivision = matchedVendor?.division || '';
  const vendorPincode = matchedVendor?.pincode || '';

  // Fallback territory from vendor if customer location is missing
  if (!state && vendorState) state = vendorState;
  if (!district && vendorDistrict) district = vendorDistrict;
  if (!division && vendorDivision) division = vendorDivision;
  if (!pincode && vendorPincode) pincode = vendorPincode;
  if (!state) state = 'Tamil Nadu';

  const createdDateStr = item.created_at || item.createdAt || item.postedDate || item.date;

  return {
    ...item,
    id: jobId,
    _id: jobId,
    jobId,
    orderNumber: item.order_number || jobId,
    title: jobTitle,
    jobTitle,
    vendorName,
    company: vendorName,
    vendorId,
    vendorState,
    vendorDistrict,
    vendorDivision,
    vendorPincode,
    customerName: item.customer_name || item.customerName || item.candidateName || item.memberName || 'Candidate',
    candidateName: item.customer_name || item.customerName || item.candidateName || item.memberName || 'Candidate',
    candidateEmail: item.candidateEmail || item.customerEmail || item.email || 'Not provided',
    candidatePhone: item.customer_phone || item.customerPhone || item.phone || 'Not provided',
    phone: item.customer_phone || item.customerPhone || item.phone || 'Not provided',
    candidateResume: item.candidateResume || item.resumeUrl || item.resume || null,
    resumeUrl: item.candidateResume || item.resumeUrl || item.resume || null,
    candidateEducation: item.candidateEducation || item.education || 'Graduate',
    experience: item.experience || 'Fresher',
    location: district ? `${district}${division ? `, ${division}` : ''}` : state,
    state,
    district,
    division,
    pincode,
    jobType: item.jobType || (jobTitle.toLowerCase().includes('senior') ? 'Full-Time' : 'Regular'),
    category: (jobTitle.toLowerCase().includes('developer') || jobTitle.toLowerCase().includes('engineer')) ? 'IT' : 'Operations',
    status: item.status || 'applied',
    postedDate: formatJobDate(createdDateStr),
    applicationDate: formatJobDate(createdDateStr),
    createdAt: createdDateStr
  };
}

function getJobs(req, res) {
  try {
    const pinMap = getPincodeDirectory();
    const vendorDir = getComprehensiveVendorDirectory();

    // 1. Gather all job applications and job postings from real MongoDB collections
    const rawJobs = Array.from(db.jobs || []);
    const orderJobs = Array.from(db.orders || []).filter(o =>
      o.type === 'Job' || String(o.id || o.order_number || '').startsWith('JOB')
    );
    const appliedJobs = Array.from(db.jobapplieds || []);

    const combined = [...rawJobs];
    const existingIds = new Set(rawJobs.map(j => String(j.id || j._id || j.jobId)));

    orderJobs.forEach(o => {
      const oId = String(o.id || o._id || o.order_number);
      if (!existingIds.has(oId)) {
        combined.push(o);
        existingIds.add(oId);
      }
    });

    appliedJobs.forEach(a => {
      const aId = String(a.id || a._id || a.applicationId);
      if (!existingIds.has(aId)) {
        combined.push(a);
        existingIds.add(aId);
      }
    });

    // 2. Normalize FIRST so all territory fields (state, district, division, pincode) are fully resolved
    const normalizedJobs = combined.map(j => normalizeJob(j, pinMap, vendorDir)).filter(Boolean);

    // 3. Geographic scoping at the backend/database level based on logged-in user's territory
    let scoped = filterByLocation(normalizedJobs, req.user);

    const { search, status } = req.query;
    let filtered = scoped;

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(j =>
        (j.title && j.title.toLowerCase().includes(q)) ||
        (j.customerName && j.customerName.toLowerCase().includes(q)) ||
        (j.candidateName && j.candidateName.toLowerCase().includes(q)) ||
        (j.vendorName && j.vendorName.toLowerCase().includes(q)) ||
        (j.id && j.id.toLowerCase().includes(q)) ||
        (j.orderNumber && j.orderNumber.toLowerCase().includes(q)) ||
        (j.pincode && j.pincode.includes(q)) ||
        (j.district && j.district.toLowerCase().includes(q)) ||
        (j.division && j.division.toLowerCase().includes(q))
      );
    }

    if (status && status !== 'all') {
      filtered = filtered.filter(j => (j.status || '').toLowerCase() === status.toLowerCase());
    }

    return res.json({
      success: true,
      count: filtered.length,
      total: filtered.length,
      jobs: filtered,
      data: filtered
    });
  } catch (error) {
    console.error('[getJobs] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch jobs', error: error.message });
  }
}

function getTechnicians(req, res) {
  try {
    let scoped = filterByLocation(Array.from(db.technicians || []), req.user);
    return res.json({ success: true, count: scoped.length, technicians: scoped, data: scoped });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch technicians', error: error.message });
  }
}

async function updateJobStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, technicianName } = req.body;

    let targetCollection = db.jobs;
    let job = await db.jobs.findById(id);
    if (!job) {
      job = await db.orders.findById(id);
      targetCollection = db.orders;
    }
    if (!job) {
      job = await db.jobapplieds.findById(id);
      targetCollection = db.jobapplieds;
    }

    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

    const pinMap = getPincodeDirectory();
    const vendorDir = getComprehensiveVendorDirectory();
    const normalized = normalizeJob(job, pinMap, vendorDir);

    const scoped = filterByLocation([normalized || job], req.user);
    if (scoped.length === 0) {
      return res.status(403).json({ success: false, message: 'Job outside your jurisdiction' });
    }

    const updates = { updatedAt: new Date().toISOString() };
    if (status) updates.status = status;
    if (technicianName) updates.technicianName = technicianName;

    const updatedJob = await targetCollection.findByIdAndUpdate(job._id || job.id, updates);

    return res.json({
      success: true,
      message: 'Job status updated',
      job: updatedJob || { ...job, ...updates }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update job', error: error.message });
  }
}

module.exports = {
  getJobs,
  getTechnicians,
  updateJobStatus
};
