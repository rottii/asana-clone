const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  // Log the error via Winston
  logger.error(`${err.status || 500} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
  if (err.stack) {
    logger.error(err.stack);
  }

  // Set default status code
  const statusCode = err.status || err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  res.status(statusCode).json({
    success: false,
    error: {
      message: statusCode === 500 && isProduction ? 'Internal Server Error' : err.message,
      // Only send stack trace in development
      stack: isProduction ? undefined : err.stack
    }
  });
};

module.exports = errorHandler;
