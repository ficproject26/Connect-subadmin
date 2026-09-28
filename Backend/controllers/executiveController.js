const { db, filterByLocation } = require('../config/db');

// Executives & Support Team
function getExecutives(req, res) {
  try {
    let scoped = filterByLocation(db.executives, req.user);
    return res.json({ success: true, count: scoped.length, executives: scoped });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch executives', error: error.message });
  }
}

function getSupportTeam(req, res) {
  try {
    let scoped = filterByLocation(db.supportTeam, req.user);
    return res.json({ success: true, count: scoped.length, tickets: scoped });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch support team', error: error.message });
  }
}

function updateTicketStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, assignedTo } = req.body;

    const ticket = db.supportTeam.find(t => t.id === id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    const scoped = filterByLocation([ticket], req.user);
    if (scoped.length === 0) {
      return res.status(403).json({ success: false, message: 'Ticket outside your jurisdiction' });
    }

    if (status) ticket.status = status;
    if (assignedTo) ticket.assignedTo = assignedTo;

    return res.json({ success: true, message: 'Ticket updated', ticket });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update ticket', error: error.message });
  }
}

/**
 * Get the normalized level of an agent.
 * db.agents stores the level in the `role` field (values: 'state', 'district', 'division', 'pincode').
 * The `level` field may be a number (1-4) or undefined.
 * This function resolves the correct string level from whichever field is populated.
 */
function getAgentLevel(agent) {
  if (!agent) return '';
  // level may be a number (1=state,2=district,3=division,4=pincode) or a string
  const lvlRaw = agent.level;
  if (typeof lvlRaw === 'number') {
    if (lvlRaw === 1) return 'state';
    if (lvlRaw === 2) return 'district';
    if (lvlRaw === 3) return 'division';
    if (lvlRaw === 4) return 'pincode';
  }
  const lvl = (String(lvlRaw || '')).toLowerCase().trim();
  const rol = (String(agent.role || '')).toLowerCase().trim();

  // Generic non-level role names to skip
  const GENERIC = new Set(['agent', 'staff', 'manager', 'vendor', 'customer', 'admin', 'super-admin', '']);

  if (lvl && !GENERIC.has(lvl)) return lvl;
  if (rol && !GENERIC.has(rol)) return rol;
  return lvl || rol || '';
}

/**
 * Normalize a level string for consistent comparison.
 * Frontend sends: 'state', 'district', 'divisional', 'pincode'
 * DB agents use:  'state', 'district', 'division', 'pincode' in `role` field
 */
function normalizeLevel(level) {
  if (!level) return '';
  const l = String(level).toLowerCase().trim();
  if (l === 'divisional' || l === 'division') return 'division';
  if (l === 'district') return 'district';
  if (l === 'state') return 'state';
  if (l === 'pincode') return 'pincode';
  return l;
}

/**
 * Get the agent's territory as a flat object.
 * Resolves from top-level fields (state, district, division, pincode)
 * or from nested territory sub-object.
 */
/**
 * Normalizes division names for comparison by removing trailing 'division' and extra spaces.
 * E.g., 'Attur Division' and 'Attur' will both normalize to 'attur'.
 */
function normalizeDivision(name) {
  if (!name) return '';
  return String(name).toLowerCase().replace(/\s+division$/i, '').trim();
}

function divisionMatches(div1, div2) {
  if (!div1 || !div2) return false;
  return normalizeDivision(div1) === normalizeDivision(div2);
}

/**
 * Get the agent's territory as a flat object.
 * Resolves from top-level fields (state, district, division, pincode)
 * or from nested territory sub-object, with fallback lookup in db.pincodes and db.divisions.
 */
function getAgentTerritory(agent) {
  if (!agent) return { state: '', district: '', division: '', pincode: '' };
  const t = agent.territory || {};
  let state = String(agent.state || t.state || '').trim();
  let district = String(agent.district || t.district || '').trim();
  let division = String(agent.division || t.division || '').trim();
  let pincode = String(agent.pincode || t.pincode || '').trim();

  // If pincode is present but state/district/division missing, resolve from db.pincodes
  if (pincode && (!state || !district || !division) && db.pincodes) {
    const pinObj = Array.from(db.pincodes || []).find(p => String(p.code || p.pincode) === pincode);
    if (pinObj) {
      if (!state && pinObj.state) state = String(pinObj.state).trim();
      if (!district && pinObj.district) district = String(pinObj.district).trim();
      if (!division && pinObj.division) division = String(pinObj.division).trim();
    }
  }

  // If division is present but state/district missing, resolve from db.divisions
  if (division && (!state || !district) && db.divisions) {
    const divObj = Array.from(db.divisions || []).find(d => divisionMatches(d.name, division));
    if (divObj) {
      if (!district && divObj.districtName) district = String(divObj.districtName).trim();
      if (!state && divObj.stateName) state = String(divObj.stateName).trim();
    }
  }

  return { state, district, division, pincode };
}

// ─────────────────────────────────────────────────────────────────
// Core Hierarchical Scoping
//
// Visibility rules:
// Super Admin / admin     → All agents across all territories
// State Admin             → All agent levels (state/district/division/pincode) within their state
// District Admin          → district + division + pincode agents within their district (NEVER state agents)
// Divisional Admin        → division + pincode agents within their division (NEVER district or state agents)
// Pincode Admin           → ONLY pincode agents in their exact pincode
// Managers (any level)    → Same as corresponding admin level
// ─────────────────────────────────────────────────────────────────
function getHierarchicalScopedAgents(allAgents, user) {
  if (!allAgents || !Array.isArray(allAgents)) return [];
  if (!user) return [];

  const rawRole = String(user.role || '');
  const role = rawRole.toLowerCase().replace(/_/g, ' ').trim();

  let userPincode = user.pincode ? String(user.pincode).trim() : null;
  let userDivision = user.division ? String(user.division).trim().toLowerCase() : null;
  let userDistrict = user.district ? String(user.district).trim().toLowerCase() : null;
  let userState = user.state ? String(user.state).trim().toLowerCase() : null;

  // If territory fields are missing on user object, check db.users
  if (user.id || user._id) {
    const dbUser = Array.from(db.users || []).find(u => String(u._id || u.id) === String(user.id || user._id));
    if (dbUser) {
      if (!userPincode && dbUser.pincode) userPincode = String(dbUser.pincode).trim();
      if (!userDivision && dbUser.division) userDivision = String(dbUser.division).trim().toLowerCase();
      if (!userDistrict && dbUser.district) userDistrict = String(dbUser.district).trim().toLowerCase();
      if (!userState && dbUser.state) userState = String(dbUser.state).trim().toLowerCase();
    }
  }

  // ── Super Admin / unrestricted admin ───────────────────────────
  if (role.includes('super admin') || role === 'admin' || role === 'super-admin' || userState === 'all india') {
    return allAgents;
  }

  // ── Pincode Admin / Pincode Manager ────────────────────────────
  if (role.includes('pincode')) {
    if (!userPincode) return [];
    return allAgents.filter(a => {
      const aLevel = normalizeLevel(getAgentLevel(a));
      if (aLevel !== 'pincode') return false;
      const t = getAgentTerritory(a);
      return Boolean(t.pincode && t.pincode === userPincode);
    });
  }

  // ── Division Admin / Divisional Admin / Division Manager ───────
  if (role.includes('division') || role.includes('divisional')) {
    if (!userDivision) return [];
    return allAgents.filter(a => {
      const aLevel = normalizeLevel(getAgentLevel(a));
      // STRICT: Division Admin can ONLY see division and pincode agents
      if (aLevel !== 'division' && aLevel !== 'pincode') return false;
      const t = getAgentTerritory(a);
      const matchesDiv = divisionMatches(t.division, userDivision);
      const matchesDist = !userDistrict || (t.district && t.district.toLowerCase() === userDistrict);
      const matchesState = !userState || (t.state && t.state.toLowerCase() === userState);
      return matchesDiv && matchesDist && matchesState;
    });
  }

  // ── District Admin / District Manager ─────────────────────────
  if (role.includes('district')) {
    if (!userDistrict) return [];
    return allAgents.filter(a => {
      const aLevel = normalizeLevel(getAgentLevel(a));
      // STRICT: District Admin can ONLY see district, division, and pincode agents (NEVER state agents)
      if (aLevel !== 'district' && aLevel !== 'division' && aLevel !== 'pincode') return false;
      const t = getAgentTerritory(a);
      const matchesDist = Boolean(t.district && t.district.toLowerCase() === userDistrict);
      const matchesState = !userState || (t.state && t.state.toLowerCase() === userState);
      return matchesDist && matchesState;
    });
  }

  // ── State Admin / State Manager ────────────────────────────────
  if (role.includes('state')) {
    if (!userState) return [];
    return allAgents.filter(a => {
      const t = getAgentTerritory(a);
      // STRICT: Must belong to the admin's state — reject cross-state agents
      return Boolean(t.state && t.state.toLowerCase() === userState);
    });
  }

  // ── Manager catch-all ──────────────────────────────────────────
  if (role.includes('manager')) {
    return allAgents.filter(a => {
      const t = getAgentTerritory(a);
      if (userPincode && (!t.pincode || t.pincode !== userPincode)) return false;
      if (userDivision && (!t.division || !divisionMatches(t.division, userDivision))) return false;
      if (userDistrict && (!t.district || t.district.toLowerCase() !== userDistrict)) return false;
      if (userState && (!t.state || t.state.toLowerCase() !== userState)) return false;
      return true;
    });
  }

  return [];
}

// ─────────────────────────────────────────────────────────────────
// GET /operations/agents
// ─────────────────────────────────────────────────────────────────
function getAgents(req, res) {
  try {
    const rawAgents = Array.from(db.agents);
    const { search, status, level, state, district, division, pincode } = req.query;

    const userRole = String(req.user?.role || '').toLowerCase().replace(/_/g, ' ').trim();
    const isSuperAdmin = userRole.includes('super admin') || userRole === 'admin' || userRole === 'super-admin' || req.user?.state === 'All India';

    // Step 1: Hierarchy-based scoping (enforced at data level)
    let scoped = getHierarchicalScopedAgents(rawAgents, req.user);

    // Step 2: Enforce state boundary — non-super-admin cannot escape their state
    const effectiveState = isSuperAdmin ? (state || null) : (req.user?.state || null);
    if (effectiveState && String(effectiveState).toLowerCase() !== 'all india') {
      scoped = scoped.filter(a => {
        const t = getAgentTerritory(a);
        return t.state && t.state.toLowerCase() === effectiveState.toLowerCase();
      });
    }

    // Step 3: Level filter — map 'divisional' → 'division' for consistent matching
    if (level) {
      const normLevel = normalizeLevel(level);
      scoped = scoped.filter(a => {
        const aLevel = normalizeLevel(getAgentLevel(a));
        return aLevel === normLevel;
      });
    }

    // Step 4: Optional territory drill-down query params
    if (district) {
      scoped = scoped.filter(a => {
        const t = getAgentTerritory(a);
        return t.district && t.district.toLowerCase() === String(district).trim().toLowerCase();
      });
    }

    if (division) {
      scoped = scoped.filter(a => {
        const t = getAgentTerritory(a);
        return divisionMatches(t.division, division);
      });
    }

    if (pincode) {
      scoped = scoped.filter(a => {
        const t = getAgentTerritory(a);
        return t.pincode === String(pincode).trim();
      });
    }

    // Step 5: Reject agents missing required territory fields for their level
    scoped = scoped.filter(a => {
      const aLevel = normalizeLevel(getAgentLevel(a));
      const t = getAgentTerritory(a);
      if (aLevel === 'state') return Boolean(t.state);
      if (aLevel === 'district') return Boolean(t.district && t.state);
      if (aLevel === 'division') return Boolean(t.division && t.district);
      if (aLevel === 'pincode') return Boolean(t.pincode);
      return Boolean(t.state || t.district || t.division || t.pincode);
    });

    // Step 6: Search filter
    if (search) {
      const q = String(search).toLowerCase();
      scoped = scoped.filter(a => {
        const t = getAgentTerritory(a);
        return (
          (a.name && String(a.name).toLowerCase().includes(q)) ||
          (a.phone && String(a.phone).includes(q)) ||
          (a.email && String(a.email).toLowerCase().includes(q)) ||
          (a.registrationId && String(a.registrationId).toLowerCase().includes(q)) ||
          (t.pincode && t.pincode.includes(q)) ||
          (t.district && t.district.toLowerCase().includes(q)) ||
          (t.division && t.division.toLowerCase().includes(q)) ||
          (t.state && t.state.toLowerCase().includes(q))
        );
      });
    }

    // Step 7: Status filter
    if (status) {
      scoped = scoped.filter(a => a.status && String(a.status).toLowerCase() === String(status).toLowerCase());
    }

    // Step 8: Format each agent with standard normalized fields
    const formattedAgents = scoped.map(a => {
      const normLevel = normalizeLevel(getAgentLevel(a));
      const terr = getAgentTerritory(a);
      const rawId = a.id || a._id;
      const idStr = rawId ? String(rawId) : `agent-${Math.random().toString(36).slice(2, 8)}`;

      let jurisdiction = 'Assigned Territory';
      let assignedArea = '';
      if (normLevel === 'pincode' && terr.pincode) {
        jurisdiction = `PIN ${terr.pincode}`;
        assignedArea = [terr.division, terr.district, terr.state].filter(Boolean).join(', ');
      } else if (normLevel === 'division' && terr.division) {
        jurisdiction = terr.division;
        assignedArea = [terr.district, terr.state].filter(Boolean).join(', ');
      } else if (normLevel === 'district' && terr.district) {
        jurisdiction = `${terr.district} District`;
        assignedArea = terr.state || '';
      } else if (normLevel === 'state' && terr.state) {
        jurisdiction = `${terr.state} State`;
        assignedArea = 'Apex State Level';
      } else {
        jurisdiction = terr.state || 'Assigned Zone';
        assignedArea = terr.district || '';
      }

      return {
        ...a,
        id: idStr,
        _id: idStr,
        level: normLevel,
        state: terr.state,
        district: terr.district,
        division: terr.division,
        pincode: terr.pincode,
        jurisdiction,
        assignedArea,
        totalReferrals: a.totalReferrals ?? 0,
        vendorOnboardings: a.vendorOnboardings ?? 0,
        walletBalance: a.walletBalance ?? 0,
        totalEarned: a.totalEarned ?? 0,
        status: a.status || 'approved'
      };
    });

    return res.json({ success: true, count: formattedAgents.length, agents: formattedAgents });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch agents', error: error.message });
  }
}

// ─────────────────────────────────────────────────────────────────
// GET /operations/agents/hierarchy
// ─────────────────────────────────────────────────────────────────
function getAgentHierarchy(req, res) {
  try {
    const rawAgents = Array.from(db.agents);
    const scopedAgents = getHierarchicalScopedAgents(rawAgents, req.user);

    const stateAgents    = scopedAgents.filter(a => normalizeLevel(getAgentLevel(a)) === 'state');
    const districtAgents = scopedAgents.filter(a => normalizeLevel(getAgentLevel(a)) === 'district');
    const divisionAgents = scopedAgents.filter(a => normalizeLevel(getAgentLevel(a)) === 'division');
    const pincodeAgents  = scopedAgents.filter(a => normalizeLevel(getAgentLevel(a)) === 'pincode');

    // Build hierarchy tree rooted at the highest authorized tier for the user
    let tree = [];
    if (stateAgents.length > 0) {
      tree = stateAgents.map(stateAg => {
        const stT = getAgentTerritory(stateAg);
        const relatedDistricts = districtAgents.filter(d => {
          const dT = getAgentTerritory(d);
          return stT.state && dT.state && dT.state.toLowerCase() === stT.state.toLowerCase();
        });
        return {
          ...stateAg,
          children: relatedDistricts.map(distAg => {
            const dT = getAgentTerritory(distAg);
            const relatedDivisions = divisionAgents.filter(div => {
              const divT = getAgentTerritory(div);
              return dT.district && divT.district && divT.district.toLowerCase() === dT.district.toLowerCase();
            });
            return {
              ...distAg,
              children: relatedDivisions.map(divAg => {
                const vT = getAgentTerritory(divAg);
                const relatedPincodes = pincodeAgents.filter(pin => {
                  const pT = getAgentTerritory(pin);
                  return divisionMatches(vT.division, pT.division);
                });
                return { ...divAg, children: relatedPincodes };
              })
            };
          })
        };
      });
    } else if (districtAgents.length > 0) {
      // Root at district level for District Admin
      tree = districtAgents.map(distAg => {
        const dT = getAgentTerritory(distAg);
        const relatedDivisions = divisionAgents.filter(div => {
          const divT = getAgentTerritory(div);
          return dT.district && divT.district && divT.district.toLowerCase() === dT.district.toLowerCase();
        });
        return {
          ...distAg,
          children: relatedDivisions.map(divAg => {
            const vT = getAgentTerritory(divAg);
            const relatedPincodes = pincodeAgents.filter(pin => {
              const pT = getAgentTerritory(pin);
              return divisionMatches(vT.division, pT.division);
            });
            return { ...divAg, children: relatedPincodes };
          })
        };
      });
    } else if (divisionAgents.length > 0) {
      // Root at division level for Divisional Admin
      tree = divisionAgents.map(divAg => {
        const vT = getAgentTerritory(divAg);
        const relatedPincodes = pincodeAgents.filter(pin => {
          const pT = getAgentTerritory(pin);
          return divisionMatches(vT.division, pT.division);
        });
        return { ...divAg, children: relatedPincodes };
      });
    } else {
      // Pincode level
      tree = pincodeAgents.map(pin => ({ ...pin, children: [] }));
    }

    return res.json({
      success: true,
      summary: {
        totalStateAgents: stateAgents.length,
        totalDistrictAgents: districtAgents.length,
        totalDivisionalAgents: divisionAgents.length,
        totalPincodeAgents: pincodeAgents.length,
        hierarchyChain: 'State Agent -> District Agent -> Divisional Agent -> Pincode Agent'
      },
      tree,
      allAgents: scopedAgents
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch agent hierarchy', error: error.message });
  }
}

// ─────────────────────────────────────────────────────────────────
// GET /operations/agents/activities
// ─────────────────────────────────────────────────────────────────
function getAgentActivities(req, res) {
  try {
    let activities = Array.from(db.agentActivities || []);
    const user = req.user;
    const userRole = String(user?.role || '').toLowerCase().replace(/_/g, ' ').trim();

    if (userRole.includes('super admin') || userRole === 'admin' || userRole === 'super-admin' || user?.state === 'All India') {
      // Super Admin: all activities
    } else if (userRole.includes('pincode')) {
      const pin = user?.pincode ? String(user.pincode).trim() : '';
      if (!pin) activities = [];
      else activities = activities.filter(act => act.pincode && String(act.pincode).trim() === pin);
    } else if (userRole.includes('division') || userRole.includes('divisional')) {
      const div = user?.division ? String(user.division).trim() : '';
      if (!div) activities = [];
      else {
        activities = activities.filter(act => {
          const matchesDiv = divisionMatches(act.division, div);
          const matchesDist = !user.district || (act.district && act.district.toLowerCase() === user.district.toLowerCase());
          const matchesState = !user.state || (act.state && act.state.toLowerCase() === user.state.toLowerCase());
          return matchesDiv && matchesDist && matchesState;
        });
      }
    } else if (userRole.includes('district')) {
      const dist = user?.district ? String(user.district).trim().toLowerCase() : '';
      if (!dist) activities = [];
      else {
        activities = activities.filter(act => {
          const matchesDist = act.district && act.district.toLowerCase() === dist;
          const matchesState = !user.state || (act.state && act.state.toLowerCase() === user.state.toLowerCase());
          return matchesDist && matchesState;
        });
      }
    } else if (userRole.includes('state')) {
      const st = user?.state ? String(user.state).trim().toLowerCase() : '';
      if (!st) activities = [];
      else {
        activities = activities.filter(act => act.state && act.state.toLowerCase() === st);
      }
    } else if (userRole.includes('manager')) {
      activities = activities.filter(act => {
        if (user.pincode && (!act.pincode || String(act.pincode).trim() !== String(user.pincode).trim())) return false;
        if (user.division && (!act.division || !divisionMatches(act.division, user.division))) return false;
        if (user.district && (!act.district || act.district.toLowerCase() !== user.district.toLowerCase())) return false;
        if (user.state && (!act.state || act.state.toLowerCase() !== user.state.toLowerCase())) return false;
        return true;
      });
    }

    const { stage, status, type, pincode, division, district, search } = req.query;

    if (stage) activities = activities.filter(a => a.currentStage && a.currentStage.toLowerCase().includes(stage.toLowerCase()));
    if (status) activities = activities.filter(a => a.status && a.status.toLowerCase().includes(status.toLowerCase()));
    if (type) activities = activities.filter(a => a.type && a.type.toLowerCase().includes(type.toLowerCase()));
    if (district) activities = activities.filter(a => a.district && a.district.toLowerCase() === district.toLowerCase());
    if (division) activities = activities.filter(a => a.division && a.division.toLowerCase() === division.toLowerCase());
    if (pincode) activities = activities.filter(a => a.pincode && a.pincode.toString() === pincode.toString());
    if (search) {
      const q = search.toLowerCase();
      activities = activities.filter(a =>
        (a.title && a.title.toLowerCase().includes(q)) ||
        (a.vendorDetails && a.vendorDetails.name && a.vendorDetails.name.toLowerCase().includes(q)) ||
        (a.pincodeAgent && a.pincodeAgent.name && a.pincodeAgent.name.toLowerCase().includes(q)) ||
        (a.pincode && String(a.pincode).includes(q))
      );
    }

    return res.json({ success: true, count: activities.length, activities });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch agent activities', error: error.message });
  }
}

// ─────────────────────────────────────────────────────────────────
// POST /operations/agents/activities
// ─────────────────────────────────────────────────────────────────
function createAgentActivity(req, res) {
  try {
    const {
      vendorName,
      category = 'Services',
      contactPerson,
      phone,
      address,
      pincode = '636001',
      division = 'Salem North',
      district = 'Salem',
      state = 'Tamil Nadu',
      notes = 'Initial ground survey and document submission by pincode agent'
    } = req.body;

    if (!vendorName) {
      return res.status(400).json({ success: false, message: 'Vendor name is required' });
    }

    // Find agents by normalized level (uses role field for db.agents records)
    const pincodeAgent = db.agents.find(a =>
      normalizeLevel(getAgentLevel(a)) === 'pincode' &&
      getAgentTerritory(a).pincode === String(pincode)
    ) || db.agents.find(a => normalizeLevel(getAgentLevel(a)) === 'pincode') || {
      id: 'AGT-UNASSIGNED', name: 'Unassigned Pincode Agent', phone: '-', pincode
    };

    const divAgent = db.agents.find(a =>
      normalizeLevel(getAgentLevel(a)) === 'division' &&
      getAgentTerritory(a).division.toLowerCase() === division.toLowerCase()
    ) || { id: 'AGT-UNASSIGNED', name: 'Unassigned Divisional Agent', division };

    const distAgent = db.agents.find(a =>
      normalizeLevel(getAgentLevel(a)) === 'district' &&
      getAgentTerritory(a).district.toLowerCase() === district.toLowerCase()
    ) || { id: 'AGT-UNASSIGNED', name: 'Unassigned District Agent', district };

    const stAgent = db.agents.find(a =>
      normalizeLevel(getAgentLevel(a)) === 'state' &&
      getAgentTerritory(a).state.toLowerCase() === state.toLowerCase()
    ) || db.agents.find(a => normalizeLevel(getAgentLevel(a)) === 'state') ||
      { id: 'AGT-UNASSIGNED', name: 'Unassigned State Agent', state };

    const newId = `ACT-VND-${String((db.agentActivities?.length || 0) + 1).padStart(3, '0')}`;
    const now = new Date();
    const formattedDate = now.toISOString().split('T')[0];
    const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newActivity = {
      id: newId,
      type: 'Vendor Onboarding',
      title: `Vendor Onboarding: ${vendorName}`,
      description: `Field vendor onboarding and KYC paper collection by ${pincodeAgent.name} (PIN: ${pincode}).`,
      state, district, division, pincode, category,
      vendorDetails: {
        id: `VND-NEW-${Date.now().toString().slice(-4)}`,
        name: vendorName,
        contactPerson: contactPerson || 'Merchant Contact',
        phone: phone || '+91 98000 00000',
        address: address || `${pincode}, ${division}, ${district}`,
        category
      },
      pincodeAgent: {
        id: pincodeAgent.id || pincodeAgent._id,
        name: pincodeAgent.name,
        phone: pincodeAgent.phone,
        pincode: getAgentTerritory(pincodeAgent).pincode || pincode
      },
      divisionalAgent: {
        id: divAgent.id || divAgent._id,
        name: divAgent.name,
        division: getAgentTerritory(divAgent).division || division
      },
      districtAgent: {
        id: distAgent.id || distAgent._id,
        name: distAgent.name,
        district: getAgentTerritory(distAgent).district || district
      },
      stateAgent: {
        id: stAgent.id || stAgent._id,
        name: stAgent.name,
        state: getAgentTerritory(stAgent).state || state
      },
      currentStage: 'Divisional Agent',
      status: 'Divisional Review',
      flowStages: [
        { stage: 'Pincode Agent', actor: `${pincodeAgent.name} (PIN ${pincode})`, action: 'Onboarding Initiated', status: 'Completed', timestamp: `${formattedDate} ${formattedTime}`, notes: notes || 'Merchant enrolled on ground, KYC submitted.' },
        { stage: 'Divisional Agent', actor: `${divAgent.name} (${division})`, action: 'Under Review', status: 'In Progress', timestamp: `${formattedDate} ${formattedTime}`, notes: 'Awaiting divisional cluster verification.' },
        { stage: 'District Agent', actor: `${distAgent.name} (${district})`, action: 'Pending Divisional Verification', status: 'Queued', timestamp: null, notes: 'Territorial oversight queued.' },
        { stage: 'State Agent', actor: `${stAgent.name} (${state})`, action: 'Pending District Endorsement', status: 'Queued', timestamp: null, notes: 'State tracking enabled.' }
      ],
      commissionAmount: 1500,
      createdDate: formattedDate,
      completedDate: null
    };

    if (!db.agentActivities) db.agentActivities = [];
    db.agentActivities.unshift(newActivity);

    const foundAgent = db.agents.find(a => String(a.id || a._id) === String(pincodeAgent.id || pincodeAgent._id));
    if (foundAgent) foundAgent.vendorOnboardings = (foundAgent.vendorOnboardings || 0) + 1;

    return res.status(201).json({ success: true, message: 'Vendor onboarding activity created and routed to Divisional Agent', activity: newActivity });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to create agent activity', error: error.message });
  }
}

// ─────────────────────────────────────────────────────────────────
// PATCH /operations/agents/activities/:id/advance
// ─────────────────────────────────────────────────────────────────
function advanceAgentActivity(req, res) {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const activity = (db.agentActivities || []).find(a => a.id === id);

    if (!activity) {
      return res.status(404).json({ success: false, message: 'Activity record not found' });
    }

    const now = new Date();
    const formattedDate = now.toISOString().split('T')[0];
    const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (activity.currentStage === 'Divisional Agent') {
      activity.currentStage = 'District Agent';
      activity.status = 'District Review';
      activity.flowStages[1].status = 'Completed';
      activity.flowStages[1].action = 'Division Verified';
      activity.flowStages[1].timestamp = `${formattedDate} ${formattedTime}`;
      if (notes) activity.flowStages[1].notes = notes;
      activity.flowStages[2].status = 'In Progress';
      activity.flowStages[2].action = 'Under Review';
      activity.flowStages[2].timestamp = `${formattedDate} ${formattedTime}`;
    } else if (activity.currentStage === 'District Agent') {
      activity.currentStage = 'State Agent';
      activity.status = 'State Review';
      activity.flowStages[2].status = 'Completed';
      activity.flowStages[2].action = 'District Endorsed';
      activity.flowStages[2].timestamp = `${formattedDate} ${formattedTime}`;
      if (notes) activity.flowStages[2].notes = notes;
      activity.flowStages[3].status = 'In Progress';
      activity.flowStages[3].action = 'Final Verification';
      activity.flowStages[3].timestamp = `${formattedDate} ${formattedTime}`;
    } else if (activity.currentStage === 'State Agent' && activity.status !== 'State Approved') {
      activity.status = 'State Approved';
      activity.completedDate = formattedDate;
      activity.flowStages[3].status = 'Completed';
      activity.flowStages[3].action = 'Statewide Activation';
      activity.flowStages[3].timestamp = `${formattedDate} ${formattedTime}`;
      if (notes) activity.flowStages[3].notes = notes;

      const pinAgent = db.agents.find(a => String(a.id || a._id) === String(activity.pincodeAgent?.id));
      if (pinAgent) {
        pinAgent.walletBalance = (pinAgent.walletBalance || 0) + (activity.commissionAmount || 1500);
        pinAgent.totalEarned = (pinAgent.totalEarned || 0) + (activity.commissionAmount || 1500);
      }
    }

    return res.json({ success: true, message: `Activity advanced to ${activity.currentStage} (${activity.status})`, activity });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to advance activity', error: error.message });
  }
}

module.exports = {
  getExecutives,
  getSupportTeam,
  updateTicketStatus,
  getAgents,
  getAgentHierarchy,
  getAgentActivities,
  createAgentActivity,
  advanceAgentActivity
};
