const express = require('express');
const router = express.Router();
const { addAccount, getAccounts } = require('../controllers/accountController');

router.post('/', addAccount);
router.get('/', getAccounts);

module.exports = router;