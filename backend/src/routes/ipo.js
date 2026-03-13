const express = require('express');
const router = express.Router();
const { bulkApply } = require('../controllers/ipoController');

// Route to trigger bulk application
router.post('/apply-ipo', bulkApply);

module.exports = router;