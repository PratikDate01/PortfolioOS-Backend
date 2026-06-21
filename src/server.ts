import dotenv from 'dotenv';
// Load environment variables early
dotenv.config();

import { validateEnv } from './config/env';
// Validate required environment settings
validateEnv();

import app from './app';
import { connectDB } from './config/db';

const PORT = process.env.PORT || 5000;

// Connect to Database
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });
}).catch((err) => {
  console.error('Failed to initialize database connection:', err);
  process.exit(1);
});
