const User = require('../models/User');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { formatUser } = require('./authController');

const listUsers = catchAsync(async (req, res) => {
  const users = await User.find({ _id: { $ne: req.user._id } });
  res.status(200).json({ users: users.map(formatUser) });
});

const getUserById = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return next(new AppError('User not found', 404));
  }
  res.status(200).json({ user: formatUser(user) });
});

const updateUserRole = catchAsync(async (req, res, next) => {
  const { role } = req.body;
  if (!['user', 'admin'].includes(role)) {
    return next(new AppError('Role must be "user" or "admin"', 400));
  }

  const user = await User.findByIdAndUpdate(req.params.id, { role }, { returnDocument: 'after', runValidators: true });
  if (!user) {
    return next(new AppError('User not found', 404));
  }

  res.status(200).json({ message: 'Role updated', user: formatUser(user) });
});

const deleteUser = catchAsync(async (req, res, next) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) {
    return next(new AppError('User not found', 404));
  }
  res.status(200).json({ message: 'User deleted' });
});

module.exports = { listUsers, getUserById, updateUserRole, deleteUser };
