function errorHandler(err, req, res, next) {
  console.error(err.stack);
  if (err.name === 'MulterError') {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: err.message },
    });
  }

  const status = err.status || 500;
  const code = status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR';
  res.status(status).json({
    success: false,
    error: { code, message: err.message || 'Internal Server Error' },
  });
}

module.exports = { errorHandler };
