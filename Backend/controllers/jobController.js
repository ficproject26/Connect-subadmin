const { db, filterByLocation } = require('../config/db');
const { getComprehensiveVendorDirectory } = require('../utils/vendorDirectory');
const { resolveAdminTerritory, isEntityInAdminTerritory } = require('../utils/permissions');

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

  // Vendor / Company Lookup via comprehensive vendor directory
  const vendorKey = String(item.vendor_id || item.vendorId || '').trim();
  let matchedVendor = null;
  if (vendorDir && vendorKey) {
    if (typeof vendorDir.findVendor === 'function') {
      matchedVendor = vendorDir.findVendor(vendorKey);
    } else if (vendorDir.vendorMap instanceof Map) {
      matchedVendor = vendorDir.vendorMap.get(vendorKey) || vendorDir.vendorMap.get(vendorKey.toLowerCase());
    } else if (typeof vendorDir.get === 'function') {
      matchedVendor = vendorDir.get(vendorKey);
    }
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
  const vendorStateId = matchedVendor?.stateId || item.vendorStateId || null;
  const vendorDistrictId = matchedVendor?.districtId || item.vendorDistrictId || null;
  const vendorDivisionId = matchedVendor?.divisionId || item.vendorDivisionId || null;
  const vendorPincodeId = matchedVendor?.pincodeId || item.vendorPincodeId || null;

  // Geographic coordinates - VENDOR TERRITORY IS SOURCE OF TRUTH (Part 11 & 12)
  let state = vendorState || '';
  let district = vendorDistrict || '';
  let division = vendorDivision || '';
  let pincode = vendorPincode || '';

  // If vendor territory incomplete, enrich from vendor's postal pincode
  if (pincode && (!state || !district || !division)) {
    const vPinGeo = pinMap.get(pincode) || {};
    if (!state) state = vPinGeo.state || '';
    if (!district) district = vPinGeo.district || '';
    if (!division) division = vPinGeo.division || '';
  }

  // Fallback to item territory if vendor was completely unassigned
  if (!state && item.state) state = item.state;
  if (!district && item.district) district = item.district;
  if (!division && item.division) division = item.division;
  if (!pincode && (item.pincode || item.deliveryPincode)) pincode = item.pincode || item.deliveryPincode;
  if (!state) state = 'Tamil Nadu';

  const customerAddress = item.customer_address || item.customerAddress || item.address || item.location || '';
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
    vendorStateId,
    vendorDistrictId,
    vendorDivisionId,
    vendorPincodeId,
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
    stateId: item.stateId || vendorStateId || null,
    districtId: item.districtId || vendorDistrictId || null,
    divisionId: item.divisionId || vendorDivisionId || null,
    pincodeId: item.pincodeId || vendorPincodeId || null,
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

    // 1. Territory Data Validation & Authentication Check (Part 16)
    const territory = resolveAdminTerritory(req.user);
    if (!territory.isValid) {
      return res.json({
        success: true,
        count: 0,
        total: 0,
        jobs: [],
        data: [],
        message: territory.message
      });
    }

    // 2. Gather all job applications and job postings from real MongoDB collections
    const rawJobs = Array.from(db.jobs || []);
    const orderJobs = Array.from(db.orders || []).filter(o =>
      String(o.type || o.category || '').toLowerCase() === 'job' || String(o.id || o.order_number || '').startsWith('JOB')
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

    // 3. Normalize FIRST so all territory fields are strictly vendor/business territory (Part 11, 12)
    const normalizedJobs = combined.map(j => normalizeJob(j, pinMap, vendorDir)).filter(Boolean);

    // 4. Territory scoping at backend level based on logged-in user's territory (Part 11, 12)
    let scoped = normalizedJobs.filter(j => isEntityInAdminTerritory(j, territory));

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

    const pageNum = parseInt(req.query.page, 10);
    const limitNum = parseInt(req.query.limit, 10);
    let pagedJobs = filtered;
    let pagination = null;

    if (!isNaN(pageNum) && !isNaN(limitNum) && limitNum > 0) {
      const startIndex = (pageNum - 1) * limitNum;
      pagedJobs = filtered.slice(startIndex, startIndex + limitNum);
      pagination = {
        page: pageNum,
        limit: limitNum,
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / limitNum) || 1
      };
    }

    return res.json({
      success: true,
      count: pagedJobs.length,
      total: filtered.length,
      jobs: pagedJobs,
      data: pagedJobs,
      pagination: pagination || {
        page: 1,
        limit: filtered.length,
        total: filtered.length,
        totalPages: 1
      }
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
