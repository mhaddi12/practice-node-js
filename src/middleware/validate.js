const { validationResult } = require('express-validator');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  const message = errors
    .array()
    .map((e) => e.msg)
    .join(', ');
  res.status(400).json({ error: message });
}

module.exports = validate;
