const bcrypt = require('bcryptjs');

// Pre-hashed password for "admin123"
const DEFAULT_HASH = bcrypt.hashSync('admin123', 10);

const hierarchy = {
  states: []
};

// System Administrative Accounts for Role-Based Access (No demo sub-admins)
const admins = [];

// Clean Operational Stores (No mock/sample data)
const pincodeDetails = [];
const customers = [];
const vendors = [];
const vendorPayments = [];
const orders = [];
const bookings = [];
const jobs = [];
const technicians = [];
const executives = [];
const supportTeam = [];
const agents = [];
const agentPayments = [];
const agentActivities = [];
const kycRecords = [];
const qualityCheckRecords = [];

module.exports = {
  hierarchy,
  admins,
  pincodeDetails,
  customers,
  vendors,
  vendorPayments,
  orders,
  bookings,
  jobs,
  technicians,
  executives,
  supportTeam,
  agents,
  agentPayments,
  agentActivities,
  kycRecords,
  qualityCheckRecords
};
