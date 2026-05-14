const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Worker = require('./models/Worker');

dotenv.config();

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/sewa');
    console.log('Connected to MongoDB');

    // Clear existing
    await User.deleteMany();
    await Worker.deleteMany();

    const bcrypt = require('bcryptjs');
    const adminPassword = await bcrypt.hash('admin123', 12);

    const userPassword = await bcrypt.hash('user123', 12);
    // Create 3 demo workers (as users first) and 1 Admin
    const users = await User.insertMany([
      { name: 'Rajan K.', phone: '9876543210', email: 'rajan@example.com', role: 'worker', isVerified: true, location: { type: 'Point', coordinates: [75.7804, 11.2588] } },
      { name: 'Anitha M.', phone: '9876543211', email: 'anitha@example.com', role: 'worker', isVerified: true, location: { type: 'Point', coordinates: [75.7804, 11.2588] } },
      { name: 'Suresh P.', phone: '9876543212', email: 'suresh@example.com', role: 'worker', isVerified: true, location: { type: 'Point', coordinates: [75.7804, 11.2588] } },
      { name: 'Demo User', phone: '1234567890', email: 'user@example.com', role: 'user', isVerified: true, passwordHash: userPassword, location: { type: 'Point', coordinates: [75.7804, 11.2588] } },
      { name: 'Admin Sewa', phone: '0000000000', email: 'admin@sewa.com', role: 'admin', isVerified: true, passwordHash: adminPassword }
    ]);

    // Create worker profiles
    await Worker.insertMany([
      {
        user: users[0]._id,
        skills: ['Electrical'],
        experience: 9,
        hourlyRate: 350,
        isAvailable: true,
        isApproved: true,
        rating: { average: 4.9, count: 312 },
        serviceRadius: 10,
        bio: 'Expert electrician for home and commercial wiring.'
      },
      {
        user: users[1]._id,
        skills: ['Tutoring'],
        experience: 5,
        hourlyRate: 500,
        isAvailable: true,
        isApproved: true,
        rating: { average: 5.0, count: 180 },
        serviceRadius: 15,
        bio: 'Mathematics and Science tutor for high school students.'
      },
      {
        user: users[2]._id,
        skills: ['Plumbing'],
        experience: 7,
        hourlyRate: 280,
        isAvailable: true,
        isApproved: true,
        rating: { average: 4.7, count: 256 },
        serviceRadius: 5,
        bio: 'Quick and reliable plumbing services.'
      }
    ]);

    console.log('Database seeded successfully');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding database:', err);
    process.exit(1);
  }
};

seedDatabase();
