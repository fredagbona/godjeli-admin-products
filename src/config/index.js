require('dotenv').config();
const { v2: cloudinary } = require('cloudinary');
const mongoose = require('mongoose');

const config = {
  port: process.env.PORT || 3000,
  adminPin: process.env.ADMIN_ACCESS_PIN,
  mongoUri: process.env.MONGODB_URI,
};

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function connectDB() {
  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected');
  });

  await mongoose.connect(config.mongoUri);
  console.log('MongoDB connected');
}

module.exports = { config, cloudinary, connectDB };
