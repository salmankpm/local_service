const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name:  { type: String, required: [true, 'Name is required'], trim: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    phone: { type: String, required: [true, 'Phone is required'], unique: true, trim: true },
    passwordHash: { type: String, select: false },
    avatar:       { type: String, default: '' },

    role: {
      type:    String,
      enum:    ['user', 'worker', 'admin'],
      default: 'user',
    },

    location: {
      type:        { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
      address:     { type: String, default: '' },
    },

    isVerified: { type: Boolean, default: false },
    isActive:   { type: Boolean, default: true  },
    fcmToken:   { type: String,  default: ''    }, // Firebase push token

    otp:          { type: String,  select: false },
    otpExpiresAt: { type: Date,    select: false },
  },
  { timestamps: true }
);

// 2dsphere index for geo-queries
userSchema.index({ location: '2dsphere' });

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  next();
});

// Compare password
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(enteredPassword, this.passwordHash);
};

// Remove sensitive fields from JSON output
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.otp;
  delete obj.otpExpiresAt;
  return obj;
};

module.exports = mongoose.model('User', userSchema);