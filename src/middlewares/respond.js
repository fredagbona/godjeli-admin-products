/**
 * Standardised response helpers.
 *
 * Success envelope:  { success: true,  data: <payload> }
 * Error envelope:    { success: false, error: { code, message, details? } }
 */

function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

function created(res, data) {
  return ok(res, data, 201);
}

function fail(res, status, code, message, details) {
  const error = { code, message };
  if (details !== undefined) error.details = details;
  return res.status(status).json({ success: false, error });
}

// Shortcuts for common cases
const notFound = (res, message = 'Resource not found') =>
  fail(res, 404, 'NOT_FOUND', message);

const badRequest = (res, message, details) =>
  fail(res, 400, 'VALIDATION_ERROR', message, details);

const unauthorized = (res, message = 'PIN invalide ou manquant.') =>
  fail(res, 401, 'UNAUTHORIZED', message);

const unprocessable = (res, message) =>
  fail(res, 422, 'UNPROCESSABLE', message);

module.exports = { ok, created, fail, notFound, badRequest, unauthorized, unprocessable };
