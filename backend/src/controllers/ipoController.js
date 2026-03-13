const { applyIpoForAccount } = require('../services/automationService');
const { decrypt } = require('../utils/crypto');
const pool = require('../config/db');

const bulkApply = async (req, res) => {
    const { ipoDetails } = req.body; // Contains quantity, companyId, etc.
    const results = [];

    try {
        // Fetch all accounts from DB
        const accountsQuery = await pool.query('SELECT * FROM accounts');
        const accounts = accountsQuery.rows;

        for (const account of accounts) {
            // Decrypt credentials for the bot
            account.decryptedPassword = decrypt(account.password);
            account.decryptedPin = decrypt(account.pin);

            // Execute automation
            const status = await applyIpoForAccount(account, ipoDetails);
            results.push(status);

            // 2-second delay to avoid bot detection
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        res.status(200).json({ message: "Bulk process completed", results });
    } catch (error) {
        res.status(500).json({ error: "Bulk application failed: " + error.message });
    }
};

module.exports = { bulkApply };