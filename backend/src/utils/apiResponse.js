// Standard response helpers
const sendSuccess = (res, statusCode = 200, message = 'Success', data = {}) => {
  res.status(statusCode).json({ success: true, message, data });
};

const sendError = (res, statusCode = 500, message = 'Error', errors = null) => {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  res.status(statusCode).json(body);
};

module.exports = { sendSuccess, sendError };
