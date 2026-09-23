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

// Scoped Agent filtering by hierarchical manager / admin role:
// - Pincode Manager: ONLY Pincode Agents in their assigned pincode
// - Division Manager: Division Agent and Pincode Agents in their assigned division
// - District Manager: District Agent, Division Agent, and Pincode Agents in their assigned district
// - State Manager: State, District, Division, and Pincode Agents in their assigned state
// - Super Admin: All Agents
function getHierarchicalScopedAgents(allAgents, user) {
  if (!allAgents || !Array.isArray(allAgents)) return [];
  if (!user) return [];

  const rawRole = user.role || '';
  const role = rawRole.toLowerCase().replace(/_/g, ' ');
  const userPincode = user.pincode ? String(user.pincode).trim() : null;
  const userDivision = user.division ? user.division.trim().toLowerCase() : null;
  const userDistrict = user.district ? user.district.trim().toLowerCase() : null;
  const userState = user.state ? user.state.trim().toLowerCase() : null;

  // Super Admin / unrestricted admin
  if (role.includes('super admin') || role === 'admin') {
    return allAgents;
  }

  // 1. Pincode Manager / Pincode Admin: Show ONLY Pincode Agents
  if (role.includes('pincode')) {
    return allAgents.filter(a => {
      const aLevel = (a.level || a.role || '').toLowerCase();
      const isPincodeAgent = aLevel.includes('pincode');
      const matchesPin = userPincode && a.pincode && String(a.pincode).trim() === userPincode;
      return isPincodeAgent && matchesPin;
    });
  }

  // 2. Division Manager / Divisional Admin: Show Division Agent and Pincode Agents in this division
  if (role.includes('division') || role.includes('divisional')) {
    return allAgents.filter(a => {
      const aLevel = (a.level || a.role || '').toLowerCase();
      const isAllowedLevel = aLevel.includes('division') || aLevel.includes('pincode');
      if (!isAllowedLevel) return false;

      const matchesDiv = !userDivision || (a.division && a.division.trim().toLowerCase() === userDivision);
      const matchesDist = !userDistrict || (a.district && a.district.trim().toLowerCase() === userDistrict);
      const matchesState = !userState || (a.state && a.state.trim().toLowerCase() === userState);
      return matchesDiv && matchesDist && matchesState;
    });
  }

  // 3. District Manager / District Admin: Show District Agent, Division Agent, and Pincode Agents in this district
  if (role.includes('district')) {
    return allAgents.filter(a => {
      const aLevel = (a.level || a.role || '').toLowerCase();
      const isAllowedLevel = aLevel.includes('district') || aLevel.includes('division') || aLevel.includes('pincode');
      if (!isAllowedLevel) return false;

      const matchesDist = !userDistrict || (a.district && a.district.trim().toLowerCase() === userDistrict);
      const matchesState = !userState || (a.state && a.state.trim().toLowerCase() === userState);
      return matchesDist && matchesState;
    });
  }

  // 4. State Manager / State Admin: Show State Agent, District Agent, Division Agent, and Pincode Agents in this state
  if (role.includes('state')) {
    return allAgents.filter(a => {
      const aLevel = (a.level || a.role || '').toLowerCase();
      const isAllowedLevel = aLevel.includes('state') || aLevel.includes('district') || aLevel.includes('division') || aLevel.includes('pincode');
      if (!isAllowedLevel) return false;

      const matchesState = !userState || (a.state && a.state.trim().toLowerCase() === userState);
      return matchesState;
    });
  }

  return [];
}

// Agents
function getAgents(req, res) {
  try {
    const rawAgents = Array.from(db.agents);
    let scoped = getHierarchicalScopedAgents(rawAgents, req.user);
    const { search, status, level, district, division, pincode } = req.query;

    if (level) {
      scoped = scoped.filter(a => a.level && a.level.toLowerCase() === level.toLowerCase());
    }
    if (district) {
      scoped = scoped.filter(a => !a.district || a.district.toLowerCase() === district.toLowerCase());
    }
    if (division) {
      scoped = scoped.filter(a => !a.division || a.division.toLowerCase() === division.toLowerCase());
    }
    if (pincode) {
      scoped = scoped.filter(a => !a.pincode || a.pincode.toString() === pincode.toString());
    }
    if (search) {
      const q = search.toLowerCase();
      scoped = scoped.filter(a =>
        (a.name && a.name.toLowerCase().includes(q)) ||
        (a.phone && a.phone.includes(q)) ||
        (a.email && a.email.toLowerCase().includes(q)) ||
        (a.jurisdiction && a.jurisdiction.toLowerCase().includes(q)) ||
        (a.pincode && a.pincode.includes(q))
      );
    }
    if (status) {
      scoped = scoped.filter(a => a.status && a.status.toLowerCase() === status.toLowerCase());
    }

    return res.json({ success: true, count: scoped.length, agents: scoped });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch agents', error: error.message });
  }
}

// Agent Hierarchy Structure: State -> District -> Division -> Pincode
function getAgentHierarchy(req, res) {
  try {
    const allAgents = db.agents;
    const stateAgents = allAgents.filter(a => a.level === 'state');
    const districtAgents = allAgents.filter(a => a.level === 'district');
    const divisionalAgents = allAgents.filter(a => a.level === 'divisional');
    const pincodeAgents = allAgents.filter(a => a.level === 'pincode');

    // Build nested tree structure
    const tree = stateAgents.map(stateAg => {
      const relatedDistricts = districtAgents.filter(d => !d.supervisorId || d.supervisorId === stateAg.id || d.state === stateAg.state);
      return {
        ...stateAg,
        children: relatedDistricts.map(distAg => {
          const relatedDivisions = divisionalAgents.filter(div => !div.supervisorId || div.supervisorId === distAg.id || div.district === distAg.district);
          return {
            ...distAg,
            children: relatedDivisions.map(divAg => {
              const relatedPincodes = pincodeAgents.filter(pin => !pin.supervisorId || pin.supervisorId === divAg.id || pin.division === divAg.division);
              return {
                ...divAg,
                children: relatedPincodes
              };
            })
          };
        })
      };
    });

    const summary = {
      totalStateAgents: stateAgents.length,
      totalDistrictAgents: districtAgents.length,
      totalDivisionalAgents: divisionalAgents.length,
      totalPincodeAgents: pincodeAgents.length,
      hierarchyChain: 'State Agent -> District Agent -> Divisional Agent -> Pincode Agent'
    };

    return res.json({ success: true, summary, tree, allAgents });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch agent hierarchy', error: error.message });
  }
}

// Agent Activities & Vendor Onboarding Flow
// Visibility Rule:
// - Pincode Agent activity is visible to the Divisional Agent
// - Divisional Agent activity is visible to the District Agent
// - District Agent activity is visible to the State Agent
// - State Agent can view the complete Agent activity across the State
function getAgentActivities(req, res) {
  try {
    let activities = db.agentActivities || [];
    const user = req.user;

    // Apply strict hierarchical visibility scoping
    if (user.role === 'Pincode Admin') {
      activities = activities.filter(act => act.pincode === user.pincode);
    } else if (user.role === 'Divisional Admin') {
      activities = activities.filter(act => act.division === user.division);
    } else if (user.role === 'District Admin') {
      activities = activities.filter(act => act.district === user.district);
    } else if (user.role === 'State Admin' || user.role === 'Super Admin') {
      // State Admin can view complete Agent activity across the entire state
      if (user.state) {
        activities = activities.filter(act => !act.state || act.state === user.state);
      }
    }

    const { stage, status, type, pincode, division, district, search } = req.query;

    if (stage) {
      activities = activities.filter(a => a.currentStage && a.currentStage.toLowerCase().includes(stage.toLowerCase()));
    }
    if (status) {
      activities = activities.filter(a => a.status && a.status.toLowerCase().includes(status.toLowerCase()));
    }
    if (type) {
      activities = activities.filter(a => a.type && a.type.toLowerCase().includes(type.toLowerCase()));
    }
    if (district) {
      activities = activities.filter(a => a.district && a.district.toLowerCase() === district.toLowerCase());
    }
    if (division) {
      activities = activities.filter(a => a.division && a.division.toLowerCase() === division.toLowerCase());
    }
    if (pincode) {
      activities = activities.filter(a => a.pincode && a.pincode.toString() === pincode.toString());
    }
    if (search) {
      const q = search.toLowerCase();
      activities = activities.filter(a =>
        a.title.toLowerCase().includes(q) ||
        (a.vendorDetails && a.vendorDetails.name.toLowerCase().includes(q)) ||
        (a.pincodeAgent && a.pincodeAgent.name.toLowerCase().includes(q)) ||
        a.pincode.includes(q)
      );
    }

    return res.json({ success: true, count: activities.length, activities });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch agent activities', error: error.message });
  }
}

// Initiate new Activity / Vendor Onboarding by Pincode Agent
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

    // Find assigned pincode agent or default
    const pincodeAgent = db.agents.find(a => a.level === 'pincode' && a.pincode === pincode) ||
      db.agents.find(a => a.level === 'pincode') || {
        id: 'AGT-UNASSIGNED',
        name: 'Unassigned Pincode Agent',
        phone: '-',
        pincode: pincode
      };

    const divAgent = db.agents.find(a => a.level === 'divisional' && a.division === division) || {
      id: 'AGT-UNASSIGNED',
      name: 'Unassigned Divisional Agent',
      division: division
    };

    const distAgent = db.agents.find(a => a.level === 'district' && a.district === district) || {
      id: 'AGT-UNASSIGNED',
      name: 'Unassigned District Agent',
      district: district
    };

    const stAgent = db.agents.find(a => a.level === 'state') || {
      id: 'AGT-UNASSIGNED',
      name: 'Unassigned State Agent',
      state: state
    };

    const newId = `ACT-VND-${String((db.agentActivities?.length || 0) + 1).padStart(3, '0')}`;
    const now = new Date();
    const formattedDate = now.toISOString().split('T')[0];
    const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newActivity = {
      id: newId,
      type: 'Vendor Onboarding',
      title: `Vendor Onboarding: ${vendorName}`,
      description: `Field vendor onboarding and KYC paper collection by ${pincodeAgent.name} (PIN: ${pincode}).`,
      state,
      district,
      division,
      pincode,
      category,
      vendorDetails: {
        id: `VND-NEW-${Date.now().toString().slice(-4)}`,
        name: vendorName,
        contactPerson: contactPerson || 'Merchant Contact',
        phone: phone || '+91 98000 00000',
        address: address || `${pincode}, ${division}, ${district}`,
        category
      },
      pincodeAgent: {
        id: pincodeAgent.id,
        name: pincodeAgent.name,
        phone: pincodeAgent.phone,
        pincode: pincodeAgent.pincode || pincode
      },
      divisionalAgent: {
        id: divAgent.id,
        name: divAgent.name,
        division: divAgent.division || division
      },
      districtAgent: {
        id: distAgent.id,
        name: distAgent.name,
        district: distAgent.district || district
      },
      stateAgent: {
        id: stAgent.id,
        name: stAgent.name,
        state: stAgent.state || state
      },
      currentStage: 'Divisional Agent',
      status: 'Divisional Review',
      flowStages: [
        {
          stage: 'Pincode Agent',
          actor: `${pincodeAgent.name} (PIN ${pincode})`,
          action: 'Onboarding Initiated',
          status: 'Completed',
          timestamp: `${formattedDate} ${formattedTime}`,
          notes: notes || 'Merchant enrolled on ground, KYC submitted.'
        },
        {
          stage: 'Divisional Agent',
          actor: `${divAgent.name} (${division})`,
          action: 'Under Review',
          status: 'In Progress',
          timestamp: `${formattedDate} ${formattedTime}`,
          notes: 'Awaiting divisional cluster verification.'
        },
        {
          stage: 'District Agent',
          actor: `${distAgent.name} (${district})`,
          action: 'Pending Divisional Verification',
          status: 'Queued',
          timestamp: null,
          notes: 'Territorial oversight queued.'
        },
        {
          stage: 'State Agent',
          actor: `${stAgent.name} (${state})`,
          action: 'Pending District Endorsement',
          status: 'Queued',
          timestamp: null,
          notes: 'State tracking enabled.'
        }
      ],
      commissionAmount: 1500,
      createdDate: formattedDate,
      completedDate: null
    };

    if (!db.agentActivities) db.agentActivities = [];
    db.agentActivities.unshift(newActivity);

    // Increment agent's onboarding count
    const foundAgent = db.agents.find(a => a.id === pincodeAgent.id);
    if (foundAgent) {
      foundAgent.vendorOnboardings = (foundAgent.vendorOnboardings || 0) + 1;
    }

    return res.status(201).json({
      success: true,
      message: 'Vendor onboarding activity created and routed to Divisional Agent',
      activity: newActivity
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to create agent activity', error: error.message });
  }
}

// Advance Activity / Vendor Onboarding stage through hierarchy:
// Pincode Agent -> Divisional Agent -> District Agent -> State Agent
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
      // Advance to District Agent
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
      // Advance to State Agent
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
      // Final State Approval & Statewide Activation
      activity.status = 'State Approved';
      activity.completedDate = formattedDate;
      activity.flowStages[3].status = 'Completed';
      activity.flowStages[3].action = 'Statewide Activation';
      activity.flowStages[3].timestamp = `${formattedDate} ${formattedTime}`;
      if (notes) activity.flowStages[3].notes = notes;

      // Credit commission to Pincode agent
      const pinAgent = db.agents.find(a => a.id === activity.pincodeAgent.id);
      if (pinAgent) {
        pinAgent.walletBalance = (pinAgent.walletBalance || 0) + (activity.commissionAmount || 1500);
        pinAgent.totalEarned = (pinAgent.totalEarned || 0) + (activity.commissionAmount || 1500);
      }
    }

    return res.json({
      success: true,
      message: `Activity advanced to ${activity.currentStage} (${activity.status})`,
      activity
    });
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
