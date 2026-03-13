require('dotenv').config();
const express = require('express');
const ipoRoutes = require('./routes/ipo');
const accountRoutes = require('./routes/accounts');

const app = express();
app.use(express.json()); // Parse JSON bodies

// Routes
app.use('/api/ipo', ipoRoutes);
app.use('/api/accounts', accountRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));