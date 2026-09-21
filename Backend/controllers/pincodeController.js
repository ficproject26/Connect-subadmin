const adminController = require('./adminController');

function getPincodes(req, res) {
  return adminController.getPincodes(req, res);
}

function updatePincodeStatus(req, res) {
  return adminController.updatePincodeStatus(req, res);
}

module.exports = {
  getPincodes,
  updatePincodeStatus
};
