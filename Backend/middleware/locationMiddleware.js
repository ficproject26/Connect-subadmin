/**
 * Location-based access validator.
 * Ensures that if a user requests data with an explicit location filter param (e.g. ?pincode=636002),
 * the user cannot breach their assigned jurisdiction.
 */
function locationMiddleware(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const { role, state, district, division, pincode } = req.user;
  const queryPincode = req.query.pincode;
  const queryDivision = req.query.division;
  const queryDistrict = req.query.district;
  const queryState = req.query.state;

  // Pincode Admin can strictly ONLY query their assigned pincode
  if (role === 'Pincode Admin') {
    if (queryPincode && queryPincode !== pincode) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Pincode Admin is restricted to Pincode ${pincode} and cannot query ${queryPincode}.`
      });
    }
  }

  // Divisional Admin / Division Admin cannot query a different division or different state/district
  if (role === 'Divisional Admin' || role === 'Division Admin') {
    if (queryDivision && queryDivision !== division) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Division Admin is restricted to Division ${division} and cannot query ${queryDivision}.`
      });
    }
    if (queryDistrict && queryDistrict !== district) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Division Admin is restricted to District ${district}.`
      });
    }
  }

  // District Admin cannot query a different district
  if (role === 'District Admin') {
    if (queryDistrict && queryDistrict !== district) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: District Admin is restricted to District ${district}.`
      });
    }
  }

  // State Admin cannot query a different state
  if (role === 'State Admin') {
    if (queryState && state && queryState !== state) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: State Admin is restricted to State ${state}.`
      });
    }
  }

  next();
}

module.exports = locationMiddleware;
