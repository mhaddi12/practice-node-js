const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      select: false
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user'
    },
    isEmailVerified: {
      type: Boolean,
      default: false
    },
    emailVerificationTokenHash: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    refreshTokenHash: { type: String, select: false }
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Returns the raw token to send to the user; only the hash is persisted.
userSchema.methods.createEmailVerificationToken = function createEmailVerificationToken(expiresMin) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  this.emailVerificationTokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  this.emailVerificationExpires = new Date(Date.now() + expiresMin * 60 * 1000);
  return rawToken;
};

userSchema.methods.createPasswordResetToken = function createPasswordResetToken(expiresMin) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetTokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  this.passwordResetExpires = new Date(Date.now() + expiresMin * 60 * 1000);
  return rawToken;
};

module.exports = mongoose.model('User', userSchema);
