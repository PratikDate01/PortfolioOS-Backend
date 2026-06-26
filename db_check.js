const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI;

async function checkDb() {
  if (!MONGO_URI) {
    console.error('MONGO_URI not found in env!');
    return;
  }
  console.log('Connecting to database...');
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected!');

    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));

    // Get portfolios
    const portfolios = await mongoose.connection.db.collection('portfolios').find({}).toArray();
    console.log('\nPortfolios found:', portfolios.length);
    portfolios.forEach(p => {
      console.log(`- Username: ${p.username}, Slug: ${p.slug}, Theme: ${p.theme}`);
    });

    // Get users
    const users = await mongoose.connection.db.collection('users').find({}).toArray();
    console.log('\nUsers found:', users.length);
    users.forEach(u => {
      console.log(`- Username: ${u.username}, Name: ${u.name}, Email: ${u.email}`);
    });

  } catch (err) {
    console.error('Error connecting or querying:', err);
  } finally {
    await mongoose.disconnect();
  }
}

checkDb();
