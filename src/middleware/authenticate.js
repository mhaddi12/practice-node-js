const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { verifyAccessToken } = require('../utils/tokens');
const User = require('../models/User');

const authenticate = catchAsync(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return next(new AppError('Authentication required', 401));
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return next(new AppError('Invalid or expired token', 401));
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    return next(new AppError('User no longer exists', 401));
  }

  req.user = user;
  next();
});

module.exports = authenticate;
