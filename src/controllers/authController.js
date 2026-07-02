const User = require('../models/User');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const env = require('../config/env');
const { signAccessToken, signRefreshToken, verifyRefreshToken, hashToken } = require('../utils/tokens');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/email');

function formatUser(user) {
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    role: user.role,
    isEmailVerified: user.isEmailVerified
  };
}

async function issueTokenPair(user) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  user.refreshTokenHash = hashToken(refreshToken);
  await user.save({ validateBeforeSave: false });
  return { accessToken, refreshToken };
}

const register = catchAsync(async (req, res) => {
  const { username, email, password } = req.body;

  const user = await User.create({ username, email, password });

  const rawToken = user.createEmailVerificationToken(env.emailVerificationExpiresMin);
  await user.save({ validateBeforeSave: false });
  await sendVerificationEmail(user, rawToken);

  res.status(201).json({
    message: 'Registration successful. Check your email to verify your account.',
    user: formatUser(user),
    // Only exposed in tests so the verification flow can be exercised without reading real email.
    ...(env.nodeEnv === 'test' && { devVerificationToken: rawToken })
  });
});

const verifyEmail = catchAsync(async (req, res, next) => {
  const tokenHash = hashToken(req.params.token);

  const user = await User.findOne({
    emailVerificationTokenHash: tokenHash,
    emailVerificationExpires: { $gt: Date.now() }
  }).select('+emailVerificationTokenHash +emailVerificationExpires');

  if (!user) {
    return next(new AppError('Verification link is invalid or has expired', 400));
  }

  user.isEmailVerified = true;
  user.emailVerificationTokenHash = undefined;
  user.emailVerificationExpires = undefined;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({ message: 'Email verified successfully' });
});

const login = catchAsync(async (req, res, next) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    return next(new AppError('Invalid username or password', 401));
  }

  const { accessToken, refreshToken } = await issueTokenPair(user);

  res.status(200).json({
    message: 'Login successful',
    user: formatUser(user),
    accessToken,
    refreshToken
  });
});

const refresh = catchAsync(async (req, res, next) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return next(new AppError('Refresh token is required', 400));
  }

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    return next(new AppError('Invalid or expired refresh token', 401));
  }

  const user = await User.findById(payload.sub).select('+refreshTokenHash');
  if (!user || user.refreshTokenHash !== hashToken(refreshToken)) {
    return next(new AppError('Refresh token has been revoked', 401));
  }

  const tokens = await issueTokenPair(user);

  res.status(200).json({ message: 'Token refreshed', ...tokens });
});

const logout = catchAsync(async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    try {
      const payload = verifyRefreshToken(refreshToken);
      await User.findByIdAndUpdate(payload.sub, { $unset: { refreshTokenHash: 1 } });
    } catch {
      // Token already invalid/expired — nothing to revoke.
    }
  }
  res.status(200).json({ message: 'Logged out' });
});

const forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  // Always respond the same way so we don't leak which emails are registered.
  if (user) {
    const rawToken = user.createPasswordResetToken(env.passwordResetExpiresMin);
    await user.save({ validateBeforeSave: false });
    await sendPasswordResetEmail(user, rawToken);
  }

  res.status(200).json({ message: 'If that email is registered, a reset link has been sent.' });
});

const resetPassword = catchAsync(async (req, res, next) => {
  const tokenHash = hashToken(req.params.token);

  const user = await User.findOne({
    passwordResetTokenHash: tokenHash,
    passwordResetExpires: { $gt: Date.now() }
  }).select('+passwordResetTokenHash +passwordResetExpires');

  if (!user) {
    return next(new AppError('Reset link is invalid or has expired', 400));
  }

  user.password = req.body.password;
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  user.refreshTokenHash = undefined; // Force re-login on all devices.
  await user.save();

  res.status(200).json({ message: 'Password reset successfully' });
});

module.exports = {
  register,
  verifyEmail,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  formatUser
};
