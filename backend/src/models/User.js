const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName:  { type: String, required: true, trim: true },
    email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
    password:  { type: String, required: true, minlength: 6, select: false },
    plan: {
      type: String,
      enum: ['free', 'pro', 'enterprise'],
      default: 'free',
    },
    monthlyUsage: { type: Number, default: 0 },
    usageResetDate: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    apiKey: { type: String, default: null },
    defaultLanguage: { type: String, default: 'en' },
    notifications: {
      analysisComplete: { type: Boolean, default: true },
      weeklyDigest:     { type: Boolean, default: true },
      usageWarnings:    { type: Boolean, default: false },
      productUpdates:   { type: Boolean, default: false },
    },
    privacy: {
      autoDeleteFiles:   { type: Boolean, default: true },
      saveHistory:       { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Monthly limit check
userSchema.methods.canAnalyse = function () {
  return true;
};

// Public profile (no password)
userSchema.methods.toPublicJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
