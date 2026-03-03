const { config } = require('../config');

function pinAuth(req, res, next) {
  const pin = req.headers['x-admin-pin'];

  if (!pin || pin !== config.adminPin) {
    return res.status(401).json({ error: 'PIN invalide ou manquant.' });
  }

  next();
}

module.exports = { pinAuth };
