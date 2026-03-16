const { config } = require('../config');
const { unauthorized } = require('./respond');

function pinAuth(req, res, next) {
  const pin = req.headers['x-admin-pin'];
  if (!pin || pin !== config.adminPin) return unauthorized(res);
  next();
}

module.exports = { pinAuth };
