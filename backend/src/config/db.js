const { Pool } = require('pg');
require('dotenv').config();

// Initialize the connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = pool;