function errorHandler(err, req, res, next) {
  console.error(err.stack);
  const status = err.status || 500;
  const code = status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR';
  res.status(status).json({
    success: false,
    error: { code, message: err.message || 'Internal Server Error' },
  });
}

module.exports = { errorHandler };
