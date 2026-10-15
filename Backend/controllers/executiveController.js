const { db, filterByLocation } = require('../config/db');

// Executives & Support Team
function getExecutives(req, res) {
  try {
    let scoped = filterByLocation(db.executives, req.user);
    return res.json({ success: true, count: scoped.length, executives: scoped, data: scoped });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch executives', error: error.message });
  }
}

function getSupportTeam(req, res) {
  try {
    let scoped = filterByLocation(db.supportTeam, req.user);
    return res.json({ success: true, count: scoped.length, tickets: scoped, data: scoped });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch support team', error: error.message });
  }
}

async function updateTicketStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, assignedTo } = req.body;

    const ticket = await db.supportTeam.findOne({
      $or: [{ _id: id }, { id: id }]
    });
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    const scoped = filterByLocation([ticket], req.user);
    if (scoped.length === 0) {
      return res.status(403).json({ success: false, message: 'Ticket outside your jurisdiction' });
    }

    const updates = { updatedAt: new Date().toISOString() };
    if (status) updates.status = status;
    if (assignedTo) updates.assignedTo = assignedTo;

    const updated = await db.supportTeam.findByIdAndUpdate(ticket._id || ticket.id, updates);

    return res.json({ success: true, message: 'Ticket updated', ticket: updated || { ...ticket, ...updates } });
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
  if (l.includes('pincode') || l.includes('pin')) return 'pincode';
  if (l.includes('divis')) return 'division';
  if (l.includes('district')) return 'district';
  if (l.includes('state')) return 'state';
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

function formatAddressString(addr, fallback = 'N/A') {
  if (!addr) return fallback;
  if (typeof addr === 'string') return addr.trim() || fallback;
  if (typeof addr === 'object') {
    if (typeof addr.fullAddress === 'string' && addr.fullAddress.trim()) {
      return addr.fullAddress.trim();
    }
    const parts = [
      addr.buildingNo || addr.doorNo || addr.doorNumber || addr.houseNumber,
      addr.street || addr.streetName || addr.streetAddress,
      addr.locality || addr.area,
      addr.village || addr.town || addr.city,
      addr.postOffice,
      addr.taluk || addr.division,
      addr.district,
      addr.state,
      addr.pincode || addr.pinCode || addr.postalCode
    ].filter(Boolean).map(v => typeof v === 'string' ? v.trim() : String(v)).filter(Boolean);

    if (parts.length > 0) return parts.join(', ');
    const vals = Object.values(addr).filter(v => (typeof v === 'string' || typeof v === 'number') && String(v).trim()).map(v => String(v).trim());
    if (vals.length > 0) return vals.join(', ');
  }
  return String(addr || fallback);
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
async function getAgents(req, res) {
  try {
    if (db.agents && typeof db.agents.reloadFromMongo === 'function' && db.agents._mongoCol) {
      try {
        await db.agents.reloadFromMongo(false);
      } catch (err) {
        // silent
      }
    }
    const rawAgents = Array.from(db.agents);
    const { search, status, level, state, district, division, pincode } = req.query;

    const userRole = String(req.user?.role || '').toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ').trim();
    const isSuperAdmin = userRole.includes('super admin') || userRole === 'admin' || userRole === 'main admin' || req.user?.state === 'All India';

    // Step 0: Backend authorization validation of territory parameters against authenticated user session
    if (!isSuperAdmin) {
      const userState = (req.user?.state || '').toLowerCase().trim();
      const userDistrict = (req.user?.district || '').toLowerCase().trim();
      const userDivision = (req.user?.division || '').toLowerCase().trim();
      const userPincode = String(req.user?.pincode || '').trim();

      // State Admin: cannot access data outside their assigned state
      if (userRole.includes('state')) {
        if (state && userState && userState !== 'all india' && state.toLowerCase().trim() !== userState) {
          return res.status(403).json({
            success: false,
            code: 'UNAUTHORIZED_TERRITORY',
            message: 'Unauthorized territory access. State Admins cannot access data outside their assigned state.'
          });
        }
      }
      // District Admin: cannot access State agents or data outside their assigned district
      else if (userRole.includes('district')) {
        if (level && normalizeLevel(level) === 'state') {
          return res.status(403).json({
            success: false,
            code: 'UNAUTHORIZED_LEVEL',
            message: 'Unauthorized level access. District Admins cannot access State Agents.'
          });
        }
        if (state && userState && userState !== 'all india' && state.toLowerCase().trim() !== userState) {
          return res.status(403).json({
            success: false,
            code: 'UNAUTHORIZED_TERRITORY',
            message: 'Unauthorized territory access. District Admins cannot access data outside their assigned state.'
          });
        }
        if (district && userDistrict && userDistrict !== 'all districts' && district.toLowerCase().trim() !== userDistrict) {
          return res.status(403).json({
            success: false,
            code: 'UNAUTHORIZED_TERRITORY',
            message: 'Unauthorized territory access. District Admins cannot access data outside their assigned district.'
          });
        }
      }
      // Divisional Admin: cannot access State/District agents or data outside their assigned division
      else if (userRole.includes('division') || userRole.includes('divisional')) {
        const normLvl = level ? normalizeLevel(level) : '';
        if (normLvl === 'state' || normLvl === 'district') {
          return res.status(403).json({
            success: false,
            code: 'UNAUTHORIZED_LEVEL',
            message: 'Unauthorized level access. Divisional Admins cannot access State or District Agents.'
          });
        }
        if (state && userState && userState !== 'all india' && state.toLowerCase().trim() !== userState) {
          return res.status(403).json({
            success: false,
            code: 'UNAUTHORIZED_TERRITORY',
            message: 'Unauthorized territory access. Divisional Admins cannot access data outside their assigned state.'
          });
        }
        if (district && userDistrict && userDistrict !== 'all districts' && district.toLowerCase().trim() !== userDistrict) {
          return res.status(403).json({
            success: false,
            code: 'UNAUTHORIZED_TERRITORY',
            message: 'Unauthorized territory access. Divisional Admins cannot access data outside their assigned district.'
          });
        }
        if (division && userDivision && userDivision !== 'all divisions' && !divisionMatches(division, userDivision)) {
          return res.status(403).json({
            success: false,
            code: 'UNAUTHORIZED_TERRITORY',
            message: 'Unauthorized territory access. Divisional Admins cannot access data outside their assigned division.'
          });
        }
      }
      // Pincode Admin: cannot access higher levels or data outside their assigned pincode
      else if (userRole.includes('pincode')) {
        const normLvl = level ? normalizeLevel(level) : '';
        if (normLvl && normLvl !== 'pincode') {
          return res.status(403).json({
            success: false,
            code: 'UNAUTHORIZED_LEVEL',
            message: 'Unauthorized level access. Pincode Admins can only access Pincode Agents.'
          });
        }
        if (pincode && userPincode && userPincode !== 'all' && String(pincode).trim() !== userPincode) {
          return res.status(403).json({
            success: false,
            code: 'UNAUTHORIZED_TERRITORY',
            message: 'Unauthorized territory access. Pincode Admins cannot access data outside their assigned pincode.'
          });
        }
      }
    }

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

    // Step 3: Level filter & level-appropriate territory drill-downs
    if (level) {
      const normLevel = normalizeLevel(level);
      scoped = scoped.filter(a => {
        const aLevel = normalizeLevel(getAgentLevel(a));
        return aLevel === normLevel;
      });

      if (normLevel !== 'state' && district) {
        scoped = scoped.filter(a => {
          const t = getAgentTerritory(a);
          return t.district && t.district.toLowerCase() === String(district).trim().toLowerCase();
        });
      }

      if ((normLevel === 'division' || normLevel === 'pincode') && division) {
        scoped = scoped.filter(a => {
          const t = getAgentTerritory(a);
          return divisionMatches(t.division, division);
        });
      }

      if (normLevel === 'pincode' && pincode) {
        scoped = scoped.filter(a => {
          const t = getAgentTerritory(a);
          return t.pincode === String(pincode).trim();
        });
      }
    } else {
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
      if (String(status).toLowerCase() === 'all') {
        // Explicit all-records view
      } else {
        scoped = scoped.filter(a => a.status && String(a.status).toLowerCase() === String(status).toLowerCase());
      }
    } else {
      // By default in Agent Directories / Rosters, strictly show ONLY approved/active agents.
      // Rejected and pending applicants belong exclusively in the Agent Requests workflow.
      scoped = scoped.filter(a => {
        const s = (a.status || '').toLowerCase().trim();
        return (s === 'active' || s === 'approved') && s !== 'rejected' && !s.includes('pending');
      });
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
        assignedArea = terr.state ? `${terr.state} (Statewide)` : 'Statewide';
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
        status: (a.status && a.status.toLowerCase() === 'approved') ? 'Active' : (a.status || 'Active')
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
async function getAgentHierarchy(req, res) {
  try {
    if (db.agents && typeof db.agents.reloadFromMongo === 'function' && db.agents._mongoCol) {
      try {
        await db.agents.reloadFromMongo(false);
      } catch (err) {
        // silent
      }
    }
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
async function createAgentActivity(req, res) {
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
    await db.agentActivities.insertOne(newActivity);

    const foundAgent = db.agents.find(a => String(a.id || a._id) === String(pincodeAgent.id || pincodeAgent._id));
    if (foundAgent) {
      const updatedOnboardings = (foundAgent.vendorOnboardings || 0) + 1;
      await db.agents.findByIdAndUpdate(foundAgent.id || foundAgent._id, { vendorOnboardings: updatedOnboardings });
    }

    return res.status(201).json({ success: true, message: 'Vendor onboarding activity created and routed to Divisional Agent', activity: newActivity });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to create agent activity', error: error.message });
  }
}

// ─────────────────────────────────────────────────────────────────
// PATCH /operations/agents/activities/:id/advance
// ─────────────────────────────────────────────────────────────────
async function advanceAgentActivity(req, res) {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const activity = (db.agentActivities || []).find(a => String(a.id || a._id) === String(id));

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
        const newBal = (pinAgent.walletBalance || 0) + (activity.commissionAmount || 1500);
        const newEarned = (pinAgent.totalEarned || 0) + (activity.commissionAmount || 1500);
        await db.agents.findByIdAndUpdate(pinAgent.id || pinAgent._id, {
          walletBalance: newBal,
          totalEarned: newEarned
        });
      }
    }

    await db.agentActivities.findByIdAndUpdate(activity.id || activity._id, activity);

    return res.json({ success: true, message: `Activity advanced to ${activity.currentStage} (${activity.status})`, activity });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to advance activity', error: error.message });
  }
}

function getDeliveryPartners(req, res) {
  try {
    let scoped = filterByLocation(Array.from(db.deliveryPartners || []), req.user);
    return res.json({ success: true, count: scoped.length, deliveryPartners: scoped, data: scoped });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch delivery partners', error: error.message });
  }
}

function isRelatedAdminForAgent(admin, agent) {
  if (!admin || !agent) return false;
  const adminRole = String(admin.role || '').toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ').trim();
  const adminUserRole = String(admin.adminRole || '').toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ').trim();

  // Non-administrative roles (managers, agents, customers, vendors) cannot approve
  if (!adminRole.includes('admin') || adminRole.includes('manager') || adminRole.includes('agent')) {
    return false;
  }

  // Global Unscoped Super Admin can approve all
  const isSuper = (adminRole === 'super admin' || adminRole === 'main admin' || (adminRole === 'admin' && !adminUserRole.includes('state') && !adminUserRole.includes('district') && !adminUserRole.includes('division') && !adminUserRole.includes('pincode') && !admin.level?.includes('state'))) && (!admin.state || admin.state.toLowerCase() === 'all india');
  if (isSuper) return true;

  const aLevel = normalizeLevel(getAgentLevel(agent));
  const t = getAgentTerritory(agent);

  const clean = (val) => String(val || '').trim().toLowerCase().replace(/\s+(district|division|state)$/, '').trim();
  const uState = clean(admin.state || admin.assignedState);
  const tState = clean(t.state);
  const uDist = clean(admin.district || admin.assignedDistrict);
  const tDist = clean(t.district);
  const uDiv = clean(admin.division || admin.assignedDivision);
  const tDiv = clean(t.division);
  const uPin = String(admin.pincode || admin.assignedPincode || '').trim();
  const tPin = String(t.pincode || '').trim();

  // 1. State Agent -> ONLY State Admin of the same state
  if (aLevel === 'state') {
    if (!adminRole.includes('state') && !(adminRole === 'admin' && uState)) return false;
    return Boolean(uState && tState && uState === tState);
  }

  // 2. District Agent -> ONLY District Admin of the same district
  if (aLevel === 'district') {
    if (!adminRole.includes('district')) return false;
    const matchState = !uState || uState === 'all india' || (tState && tState === uState);
    return Boolean(matchState && uDist && tDist && uDist === tDist);
  }

  // 3. Division Agent -> ONLY Division Admin of the same division
  if (aLevel === 'division' || aLevel === 'divisional') {
    if (!adminRole.includes('division') && !adminRole.includes('divisional')) return false;
    const matchState = !uState || uState === 'all india' || (tState && tState === uState);
    const matchDist = matchState && (!uDist || uDist === 'all districts' || (tDist && tDist === uDist));
    return Boolean(matchDist && uDiv && tDiv && (uDiv === tDiv || divisionMatches(t.division, admin.division)));
  }

  // 4. Pincode Agent -> ONLY Pincode Admin of the same pincode
  if (aLevel === 'pincode') {
    if (!adminRole.includes('pincode')) return false;
    const matchState = !uState || uState === 'all india' || (tState && tState === uState);
    const matchDist = matchState && (!uDist || uDist === 'all districts' || (tDist && tDist === uDist));
    const matchDiv = matchDist && (!uDiv || uDiv === 'all divisions' || (tDiv && (tDiv === uDiv || divisionMatches(t.division, admin.division))));
    return Boolean(matchDiv && uPin && tPin && uPin === tPin);
  }

  return false;
}

function canAdminViewAgent(admin, agent) {
  if (!admin || !agent) return false;
  const adminRole = String(admin.role || '').toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ').trim();
  const adminUserRole = String(admin.adminRole || '').toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ').trim();
  const isSuper = (adminRole === 'super admin' || adminRole === 'main admin' || (adminRole === 'admin' && !adminUserRole.includes('state') && !adminUserRole.includes('district') && !adminUserRole.includes('division') && !adminUserRole.includes('pincode') && !admin.level?.includes('state'))) && (!admin.state || admin.state.toLowerCase() === 'all india');
  if (isSuper) return true;

  const aLevel = normalizeLevel(getAgentLevel(agent));
  const t = getAgentTerritory(agent);

  const clean = (val) => String(val || '').trim().toLowerCase().replace(/\s+(district|division|state)$/, '').trim();
  const uState = clean(admin.state || admin.assignedState);
  const tState = clean(t.state);
  const uDist = clean(admin.district || admin.assignedDistrict);
  const tDist = clean(t.district);
  const uDiv = clean(admin.division || admin.assignedDivision);
  const tDiv = clean(t.division);
  const uPin = String(admin.pincode || admin.assignedPincode || '').trim();
  const tPin = String(t.pincode || '').trim();

  // State Admin (or state-scoped admin): can view all agents within their state
  if (adminRole.includes('state') || (adminRole === 'admin' && uState)) {
    if (!uState || uState === 'all india') return true;
    return Boolean(tState && tState === uState);
  }

  // District Admin: can view district, division, and pincode agents in their district
  if (adminRole.includes('district')) {
    if (aLevel === 'state') return false;
    const matchState = !uState || uState === 'all india' || (tState && tState === uState);
    return Boolean(matchState && (!uDist || uDist === 'all districts' || (tDist && tDist === uDist)));
  }

  // Division Admin: can view division and pincode agents in their division
  if (adminRole.includes('division') || adminRole.includes('divisional')) {
    if (aLevel === 'state' || aLevel === 'district') return false;
    const matchState = !uState || uState === 'all india' || (tState && tState === uState);
    const matchDist = matchState && (!uDist || uDist === 'all districts' || (tDist && tDist === uDist));
    return Boolean(matchDist && (!uDiv || uDiv === 'all divisions' || (tDiv && (tDiv === uDiv || divisionMatches(t.division, admin.division)))));
  }

  // Pincode Admin: can view pincode agents in their pincode
  if (adminRole.includes('pincode')) {
    if (aLevel !== 'pincode') return false;
    const matchState = !uState || uState === 'all india' || (tState && tState === uState);
    const matchDist = matchState && (!uDist || uDist === 'all districts' || (tDist && tDist === uDist));
    const matchDiv = matchDist && (!uDiv || uDiv === 'all divisions' || (tDiv && (tDiv === uDiv || divisionMatches(t.division, admin.division))));
    return Boolean(matchDiv && (!uPin || uPin === 'all' || (tPin && tPin === uPin)));
  }

  return false;
}

async function getAgentRequests(req, res) {
  try {
    const userRole = String(req.user?.role || '').toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ').trim();
    const adminUserRole = String(req.user?.adminRole || '').toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ').trim();
    const isSuperAdmin = (userRole.includes('super admin') || userRole === 'main admin' || (userRole === 'admin' && !adminUserRole.includes('state') && !adminUserRole.includes('district') && !adminUserRole.includes('division') && !adminUserRole.includes('pincode') && !req.user?.level?.includes('state'))) && (!req.user?.state || req.user?.state.toLowerCase() === 'all india');

    if (!isSuperAdmin) {
      const { state, district, division, pincode } = req.query;
      const userState = (req.user?.state || '').toLowerCase().trim();
      const userDistrict = (req.user?.district || '').toLowerCase().trim();
      const userDivision = (req.user?.division || '').toLowerCase().trim();
      const userPincode = String(req.user?.pincode || '').trim();

      if (userRole.includes('state') || (userRole === 'admin' && userState)) {
        if (state && userState && userState !== 'all india' && state.toLowerCase().trim() !== userState) {
          return res.status(403).json({
            success: false,
            code: 'UNAUTHORIZED_TERRITORY',
            message: 'Unauthorized territory access. State Admins cannot access data outside their assigned state.'
          });
        }
      } else if (userRole.includes('district')) {
        if (state && userState && userState !== 'all india' && state.toLowerCase().trim() !== userState) {
          return res.status(403).json({
            success: false,
            code: 'UNAUTHORIZED_TERRITORY',
            message: 'Unauthorized territory access. District Admins cannot access data outside their assigned state.'
          });
        }
        if (district && userDistrict && userDistrict !== 'all districts' && district.toLowerCase().trim() !== userDistrict) {
          return res.status(403).json({
            success: false,
            code: 'UNAUTHORIZED_TERRITORY',
            message: 'Unauthorized territory access. District Admins cannot access data outside their assigned district.'
          });
        }
      } else if (userRole.includes('division') || userRole.includes('divisional')) {
        if (division && userDivision && userDivision !== 'all divisions' && !divisionMatches(division, userDivision)) {
          return res.status(403).json({
            success: false,
            code: 'UNAUTHORIZED_TERRITORY',
            message: 'Unauthorized territory access. Divisional Admins cannot access data outside their assigned division.'
          });
        }
      } else if (userRole.includes('pincode')) {
        if (pincode && userPincode && userPincode !== 'all' && String(pincode).trim() !== userPincode) {
          return res.status(403).json({
            success: false,
            code: 'UNAUTHORIZED_TERRITORY',
            message: 'Unauthorized territory access. Pincode Admins cannot access data outside their assigned pincode.'
          });
        }
      }
    }

    const nowTime = Date.now();
    // 1. Ensure agents collection is reloaded from MongoDB Atlas only if needed
    if (db.agents && typeof db.agents.reloadFromMongo === 'function' && db.agents._mongoCol) {
      if (!db.agents.length || (nowTime - (db.agents._lastReload || 0) > 10000)) {
        try {
          await db.agents.reloadFromMongo(false);
        } catch (err) {
          console.warn('[getAgentRequests] Atlas agents reload notice:', err.message);
        }
      }
    } else if (db.agents && typeof db.agents.initMongo === 'function' && !db.agents._mongoCol) {
      try {
        const { getMongoDb } = require('../config/mongo');
        const mdb = await getMongoDb();
        if (mdb) {
          await db.agents.initMongo(mdb);
        }
      } catch (err) {
        // fallback
      }
    }

    // 2. Also ensure db.users is reloaded if needed
    if (db.users && typeof db.users.reloadFromMongo === 'function' && db.users._mongoCol) {
      if (!db.users.length || (nowTime - (db.users._lastReload || 0) > 10000)) {
        try {
          await db.users.reloadFromMongo(false);
        } catch (err) {
          // silent
        }
      }
    }

    // 3. Build unified list of agents, merging db.agents and any agent-role records in db.users
    const agentMap = new Map();
    (Array.from(db.agents || [])).forEach(a => {
      const idKey = String(a._id || a.id || '').trim();
      const emailKey = String(a.email || '').toLowerCase().trim();
      if (idKey) agentMap.set(idKey, a);
      if (emailKey) agentMap.set(emailKey, a);
    });

    (Array.from(db.users || [])).forEach(u => {
      const r = String(u.role || '').toLowerCase();
      if (r.includes('agent') || r === 'division' || r === 'district' || r === 'pincode' || r === 'state') {
        const idKey = String(u._id || u.id || '').trim();
        const emailKey = String(u.email || '').toLowerCase().trim();
        if ((!idKey || !agentMap.has(idKey)) && (!emailKey || !agentMap.has(emailKey))) {
          agentMap.set(idKey || emailKey, u);
        }
      }
    });

    const rawAgents = Array.from(new Set(agentMap.values()));
    // Scoped to pending/under-review agent requests
    const pendingAgents = rawAgents.filter(a => {
      const s = (a.status || '').toLowerCase().trim();
      const adminApproval = (a.adminApprovalStatus || '').toLowerCase().trim();
      const isApproved = a.isApproved === true || s === 'approved' || s === 'active';
      return (
        s === 'pending' ||
        s === 'under_review' ||
        s === 'pending_approval' ||
        s === 'pending_admin_approval' ||
        s === 'pending_kyc' ||
        s === 'rejected' ||
        adminApproval === 'pending' ||
        adminApproval === 'under_review' ||
        adminApproval === 'rejected' ||
        !isApproved
      );
    });

    const visibleAgents = pendingAgents.filter(a => canAdminViewAgent(req.user, a));

    const formatted = visibleAgents.map(a => {
      const normLevel = normalizeLevel(getAgentLevel(a));
      const terr = getAgentTerritory(a);
      const rawId = a.id || a._id;
      const idStr = rawId ? String(rawId) : `agent-${Math.random().toString(36).slice(2, 8)}`;
      const canApprove = isRelatedAdminForAgent(req.user, a);

      let jurisdiction = 'Assigned Territory';
      let assignedArea = '';
      if (normLevel === 'pincode' && terr.pincode) {
        jurisdiction = `PIN ${terr.pincode}`;
        assignedArea = [terr.division, terr.district, terr.state].filter(Boolean).join(', ');
      } else if (normLevel === 'division' && terr.division) {
        jurisdiction = terr.division ? `${terr.division} Division` : 'Assigned Division';
        assignedArea = [terr.district, terr.state].filter(Boolean).join(', ');
      } else if (normLevel === 'district' && terr.district) {
        jurisdiction = `${terr.district} District`;
        assignedArea = terr.state || '';
      } else if (normLevel === 'state' && terr.state) {
        jurisdiction = `${terr.state} State`;
        assignedArea = terr.state ? `${terr.state} (Statewide)` : 'Statewide';
      } else {
        jurisdiction = terr.state || 'Assigned Zone';
        assignedArea = terr.district || '';
      }

      let workflowStage = 'Awaiting Territory Approval';
      const s = (a.status || '').toLowerCase().trim();
      const adminApproval = (a.adminApprovalStatus || '').toLowerCase().trim();
      const kycStatus = (a.kycStatus || '').toLowerCase().trim();

      if (s === 'rejected' || adminApproval === 'rejected') {
        workflowStage = 'Territory Rejected';
      } else if (kycStatus === 'rejected') {
        workflowStage = 'KYC Rejected';
      } else if (s === 'pending_kyc' || adminApproval === 'approved') {
        workflowStage = 'Awaiting KYC Review';
      } else if (adminApproval === 'pending' && (a.pendingReason || a.adminNotes)) {
        workflowStage = 'Territory Pending';
      } else if (s === 'active' || s === 'approved') {
        workflowStage = 'Activated';
      }

      return {
        ...a,
        id: idStr,
        _id: idStr,
        name: a.name || 'Unnamed Agent',
        applicantName: a.name || 'Unnamed Agent',
        level: normLevel,
        role: a.role || normLevel,
        roleTitle: `${normLevel.charAt(0).toUpperCase() + normLevel.slice(1)} Agent`,
        territory: terr,
        state: terr.state,
        district: terr.district,
        division: terr.division,
        pincode: terr.pincode,
        jurisdiction,
        assignedArea,
        rawAddress: a.address || null,
        address: formatAddressString(a.address, [terr.pincode, terr.division, terr.district, terr.state].filter(Boolean).join(', ') || 'N/A'),
        createdAt: a.createdAt || new Date().toISOString(),
        registrationDate: a.createdAt ? new Date(a.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recent',
        status: (a.status && a.status.toLowerCase() === 'approved') ? 'Active' : (a.status || 'pending'),
        adminApprovalStatus: adminApproval || 'pending',
        kycStatus: a.kycStatus || 'pending_verification',
        rejectionReason: a.rejectionReason || null,
        pendingReason: a.pendingReason || a.adminNotes || null,
        reviewerReason: a.pendingReason || a.adminNotes || a.rejectionReason || null,
        adminPendingBy: a.adminPendingBy || null,
        adminPendingById: a.adminPendingById || null,
        adminPendingByRole: a.adminPendingByRole || a.adminPendingRole || null,
        adminPendingAt: a.adminPendingAt || null,
        reviewHistory: Array.isArray(a.reviewHistory) ? a.reviewHistory : [],
        workflowStage,
        canApprove,
        documents: a.documents || a.kycDocs || {}
      };
    });

    return res.json({ success: true, count: formatted.length, requests: formatted, agents: formatted });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch agent requests', error: error.message });
  }
}

async function approveAgent(req, res) {
  try {
    const { id } = req.params;
    let agent = Array.from(db.agents || []).find(a => String(a._id || a.id) === String(id));
    if (!agent && db.agents && typeof db.agents.reloadFromMongo === 'function') {
      try {
        await db.agents.reloadFromMongo(true);
      } catch (_) {}
      agent = Array.from(db.agents || []).find(a => String(a._id || a.id) === String(id));
    }
    if (!agent) {
      agent = Array.from(db.users || []).find(u => String(u._id || u.id) === String(id));
    }

    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent request not found' });
    }

    if (!isRelatedAdminForAgent(req.user, agent)) {
      const aLevel = normalizeLevel(getAgentLevel(agent));
      return res.status(403).json({
        success: false,
        message: `You do not have administrative authority to approve this ${aLevel} agent. Approval must be performed by the designated authority for this jurisdiction.`
      });
    }

    const now = new Date().toISOString();
    const terr = getAgentTerritory(agent);
    const existingHistory = Array.isArray(agent.reviewHistory) ? agent.reviewHistory : [];
    const reviewEntry = {
      action: 'APPROVED',
      status: 'Active',
      reviewerId: req.user.id || req.user._id,
      reviewerName: req.user.name || req.user.email,
      reviewerRole: req.user.role,
      reviewedAt: now,
      timestamp: now
    };
    const updatedHistory = [...existingHistory, reviewEntry];

    const approveUpdates = {
      status: 'Active',
      overallRegistrationStatus: 'Active',
      adminApprovalStatus: 'approved',
      kycStatus: 'Verified',
      isActive: true,
      isApproved: true,
      requiresApproval: false,
      adminApprovedBy: req.user.name || req.user.email,
      adminApprovedById: req.user.id || req.user._id,
      adminApprovedByRole: req.user.role,
      adminApprovedAt: now,
      rejectionReason: null,
      pendingReason: null,
      reviewHistory: updatedHistory,
      updatedAt: now
    };
    Object.assign(agent, approveUpdates);

    await db.agents.findByIdAndUpdate(agent._id || agent.id, approveUpdates);

    // Queue in db.kycRecords for KYC team
    if (db.kycRecords) {
      const agIdStr = String(agent._id || agent.id);
      const kycId = `KYC-AGT-${agIdStr}`;
      const existingKyc = await db.kycRecords.findOne({ $or: [{ _id: kycId }, { id: kycId }, { agentId: agIdStr }] });
      if (!existingKyc) {
        await db.kycRecords.insertOne({
          _id: kycId,
          id: kycId,
          type: 'Agent',
          agentId: agIdStr,
          name: agent.name,
          category: 'Field Agency Network',
          role: agent.role || `${getAgentLevel(agent)} Agent`,
          phone: agent.phone || agent.mobile,
          email: agent.email,
          state: terr.state,
          district: terr.district,
          division: terr.division,
          pincode: terr.pincode,
          status: 'Active',
          kycStatus: 'Verified',
          submittedDate: (agent.createdAt || now).split('T')[0],
          documents: agent.documents || agent.kycDocs || {},
          notes: `Agent registration territory-approved and activated by ${req.user.role} "${req.user.name}".`,
          createdAt: now,
          updatedAt: now
        });
      } else {
        await db.kycRecords.findByIdAndUpdate(existingKyc._id || existingKyc.id, {
          status: 'Active',
          kycStatus: 'Verified',
          approvalStatus: 'approved',
          notes: `Agent registration territory-approved and activated by ${req.user.role} "${req.user.name}".`,
          updatedAt: now
        });
      }
    }

    // Synchronize corresponding user record in db.users
    if (db.users) {
      const user = (await db.users.findById(agent._id || agent.id)) ||
        Array.from(db.users || []).find(u => String(u._id || u.id) === String(agent._id || agent.id) || (u.email && agent.email && u.email.toLowerCase() === agent.email.toLowerCase()));
      if (user) {
        user.status = 'Active';
        user.isActive = true;
        user.isApproved = true;
        user.adminApprovalStatus = 'approved';
        user.kycStatus = 'Verified';
        user.adminApprovedBy = req.user.name;
        user.adminApprovedAt = now;
        user.reviewHistory = updatedHistory;
        user.updatedAt = now;
        await db.users.findByIdAndUpdate(user._id || user.id, {
          status: 'Active',
          isActive: true,
          isApproved: true,
          adminApprovalStatus: 'approved',
          kycStatus: 'Verified',
          adminApprovedBy: req.user.name,
          adminApprovedAt: now,
          reviewHistory: updatedHistory,
          updatedAt: now
        });
      }
    }

    // Audit log entry
    if (db.auditLogs) {
      await db.auditLogs.insertOne({
        action: 'AGENT_TERRITORY_APPROVED_FORWARDED_TO_KYC',
        adminId: req.user.id || req.user._id,
        adminName: req.user.name,
        adminRole: req.user.role,
        targetUserId: agent._id || agent.id,
        targetUserName: agent.name,
        targetUserRole: agent.role,
        details: `Agent "${agent.name}" (${getAgentLevel(agent)}) territory registration approved by ${req.user.role} "${req.user.name}". Forwarded to KYC Team review.`,
        ip: req.ip || '127.0.0.1',
        timestamp: now
      });
    }

    return res.json({
      success: true,
      message: `Registration for ${agent.name} approved by ${req.user.role}. Forwarded to KYC Review queue.`,
      agent: { ...agent, ...approveUpdates, canApprove: false, workflowStage: 'Awaiting KYC Review' }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to approve agent', error: error.message });
  }
}

async function rejectAgent(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    let agent = Array.from(db.agents || []).find(a => String(a._id || a.id) === String(id));
    if (!agent && db.agents && typeof db.agents.reloadFromMongo === 'function') {
      try {
        await db.agents.reloadFromMongo(true);
      } catch (_) {}
      agent = Array.from(db.agents || []).find(a => String(a._id || a.id) === String(id));
    }
    if (!agent) {
      agent = Array.from(db.users || []).find(u => String(u._id || u.id) === String(id));
    }

    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent request not found' });
    }

    if (!isRelatedAdminForAgent(req.user, agent)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have administrative authority to reject this agent registration.'
      });
    }

    const rejectionReason = (reason || '').trim();
    if (!rejectionReason) {
      return res.status(400).json({ success: false, message: 'A rejection reason is strictly required.' });
    }
    const now = new Date().toISOString();
    const terr = getAgentTerritory(agent);
    const rejectUpdates = {
      status: 'rejected',
      adminApprovalStatus: 'rejected',
      kycStatus: 'Rejected',
      isActive: false,
      isApproved: false,
      rejectionReason,
      adminRejectedBy: req.user.name || req.user.email,
      adminRejectedById: req.user.id || req.user._id,
      adminRejectedByRole: req.user.role,
      adminRejectedAt: now,
      updatedAt: now
    };
    Object.assign(agent, rejectUpdates);

    await db.agents.findByIdAndUpdate(agent._id || agent.id, rejectUpdates);

    // Forward rejection details to KYC team queue for review and closure
    if (db.kycRecords) {
      const agIdStr = String(agent._id || agent.id);
      const kycId = `KYC-AGT-${agIdStr}`;
      const existingKyc = await db.kycRecords.findOne({ $or: [{ _id: kycId }, { id: kycId }, { agentId: agIdStr }] });
      if (existingKyc) {
        await db.kycRecords.findByIdAndUpdate(existingKyc._id || existingKyc.id, {
          status: 'Pending',
          kycStatus: 'Pending Verification',
          notes: `Territory-rejected by ${req.user.role} "${req.user.name}". Reason: ${rejectionReason}`,
          updatedAt: now
        });
      } else {
        await db.kycRecords.insertOne({
          _id: kycId,
          id: kycId,
          type: 'Agent',
          agentId: agIdStr,
          name: agent.name,
          category: 'Field Agency Network',
          role: agent.role || `${getAgentLevel(agent)} Agent`,
          phone: agent.phone || agent.mobile,
          email: agent.email,
          state: terr.state,
          district: terr.district,
          division: terr.division,
          pincode: terr.pincode,
          status: 'Pending',
          kycStatus: 'Pending Verification',
          submittedDate: (agent.createdAt || now).split('T')[0],
          documents: agent.documents || agent.kycDocs || {},
          notes: `Territory-rejected by ${req.user.role} "${req.user.name}". Reason: ${rejectionReason}`,
          createdAt: now,
          updatedAt: now
        });
      }
    }

    // Synchronize corresponding user record in db.users
    if (db.users) {
      const user = (await db.users.findById(agent._id || agent.id)) ||
        Array.from(db.users || []).find(u => String(u._id || u.id) === String(agent._id || agent.id) || (u.email && agent.email && u.email.toLowerCase() === agent.email.toLowerCase()));
      if (user) {
        user.status = 'rejected';
        user.adminApprovalStatus = 'rejected';
        user.kycStatus = 'Rejected';
        user.isActive = false;
        user.rejectionReason = rejectionReason;
        user.adminRejectionReason = rejectionReason;
        user.updatedAt = now;
        await db.users.findByIdAndUpdate(user._id || user.id, {
          status: 'rejected',
          adminApprovalStatus: 'rejected',
          kycStatus: 'Rejected',
          isActive: false,
          rejectionReason,
          adminRejectionReason: rejectionReason,
          updatedAt: now
        });
      }
    }

    if (db.auditLogs) {
      await db.auditLogs.insertOne({
        action: 'AGENT_REGISTRATION_REJECTED',
        adminId: req.user.id || req.user._id,
        adminName: req.user.name,
        adminRole: req.user.role,
        targetUserId: agent._id || agent.id,
        targetUserName: agent.name,
        details: `Agent "${agent.name}" registration rejected by ${req.user.role} "${req.user.name}". Reason: ${rejectionReason}`,
        ip: req.ip || '127.0.0.1',
        timestamp: now
      });
    }

    return res.json({
      success: true,
      message: `Agent registration for ${agent.name} has been rejected.`,
      agent: { ...agent, ...rejectUpdates, canApprove: false, workflowStage: 'Territory Rejected' }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to reject agent', error: error.message });
  }
}

// POST /api/operations/agents/:id/pending - Keep agent registration pending with mandatory reason
async function keepPendingAgent(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    let agent = Array.from(db.agents || []).find(a => String(a._id || a.id) === String(id));
    if (!agent && db.agents && typeof db.agents.reloadFromMongo === 'function') {
      try {
        await db.agents.reloadFromMongo(true);
      } catch (_) {}
      agent = Array.from(db.agents || []).find(a => String(a._id || a.id) === String(id));
    }
    if (!agent) {
      agent = Array.from(db.users || []).find(u => String(u._id || u.id) === String(id));
    }

    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent request not found' });
    }

    if (!isRelatedAdminForAgent(req.user, agent)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have administrative authority to manage this agent registration.'
      });
    }

    const pendingReason = (reason || '').trim();
    if (!pendingReason) {
      return res.status(400).json({ success: false, message: 'A meaningful pending reason or administrative note is required.' });
    }

    const now = new Date().toISOString();
    const existingHistory = Array.isArray(agent.reviewHistory) ? agent.reviewHistory : [];
    const reviewEntry = {
      action: 'PENDING',
      status: 'pending',
      reason: pendingReason,
      reviewerId: req.user.id || req.user._id,
      reviewerName: req.user.name || req.user.email,
      reviewerRole: req.user.role,
      reviewedAt: now,
      timestamp: now
    };
    const updatedHistory = [...existingHistory, reviewEntry];

    const pendingUpdates = {
      status: 'pending',
      adminApprovalStatus: 'pending',
      pendingReason,
      reviewerReason: pendingReason,
      adminNotes: pendingReason,
      adminPendingBy: req.user.name || req.user.email,
      adminPendingById: req.user.id || req.user._id,
      adminPendingByRole: req.user.role,
      adminPendingAt: now,
      reviewHistory: updatedHistory,
      updatedAt: now
    };
    Object.assign(agent, pendingUpdates);

    await db.agents.findByIdAndUpdate(agent._id || agent.id, pendingUpdates);

    if (db.kycRecords) {
      const agIdStr = String(agent._id || agent.id);
      const kycId = `KYC-AGT-${agIdStr}`;
      const existingKyc = await db.kycRecords.findOne({ $or: [{ _id: kycId }, { id: kycId }, { agentId: agIdStr }] });
      if (existingKyc) {
        await db.kycRecords.findByIdAndUpdate(existingKyc._id || existingKyc.id, {
          notes: `Kept pending by ${req.user.role} "${req.user.name}". Reason: ${pendingReason}`,
          updatedAt: now
        });
      }
    }

    // Synchronize corresponding user record in db.users
    if (db.users) {
      const user = (await db.users.findById(agent._id || agent.id)) ||
        Array.from(db.users || []).find(u => String(u._id || u.id) === String(agent._id || agent.id) || (u.email && agent.email && u.email.toLowerCase() === agent.email.toLowerCase()));
      if (user) {
        user.status = 'pending';
        user.adminApprovalStatus = 'pending';
        user.pendingReason = pendingReason;
        user.reviewerReason = pendingReason;
        user.adminNotes = pendingReason;
        user.adminPendingBy = req.user.name || req.user.email;
        user.adminPendingAt = now;
        user.reviewHistory = updatedHistory;
        user.updatedAt = now;
        await db.users.findByIdAndUpdate(user._id || user.id, {
          status: 'pending',
          adminApprovalStatus: 'pending',
          pendingReason,
          reviewerReason: pendingReason,
          adminNotes: pendingReason,
          adminPendingBy: req.user.name || req.user.email,
          adminPendingAt: now,
          reviewHistory: updatedHistory,
          updatedAt: now
        });
      }
    }

    if (db.auditLogs) {
      await db.auditLogs.insertOne({
        action: 'AGENT_REGISTRATION_KEPT_PENDING',
        adminId: req.user.id || req.user._id,
        adminName: req.user.name,
        adminRole: req.user.role,
        targetUserId: agent._id || agent.id,
        targetUserName: agent.name,
        details: `Agent "${agent.name}" registration kept pending by ${req.user.role} "${req.user.name}". Reason: ${pendingReason}`,
        ip: req.ip || '127.0.0.1',
        timestamp: now
      });
    }

    return res.json({
      success: true,
      message: `Agent registration for ${agent.name} kept pending. Note saved.`,
      agent: { ...agent, ...pendingUpdates, canApprove: true, workflowStage: 'Territory Pending' }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update agent pending status', error: error.message });
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
  advanceAgentActivity,
  getDeliveryPartners,
  getAgentRequests,
  approveAgent,
  rejectAgent,
  keepPendingAgent,
  isRelatedAdminForAgent,
  canAdminViewAgent,
  getHierarchicalScopedAgents,
  getAgentTerritory,
  normalizeLevel,
  getAgentLevel
};

