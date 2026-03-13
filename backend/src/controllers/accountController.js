const pool = require('../config/db');
const { encrypt } = require('../utils/crypto');

const addAccount = async (req, res) => {
    const { name, dpid, username, password, crn, pin, boid } = req.body;
    try {
        // Encrypt sensitive fields before saving
        const encPassword = encrypt(password);
        const encPin = encrypt(pin);

        const result = await pool.query(
            'INSERT INTO accounts (name, dpid, username, password, crn, pin, boid) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
            [name, dpid, username, encPassword, crn, encPin, boid]
        );
        res.status(201).json({ id: result.rows[0].id, message: "Account added securely" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getAccounts = async (req, res) => {
    try {
        // Return accounts without passwords/pins for the UI
        const result = await pool.query('SELECT id, name, dpid, username, boid FROM accounts');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { addAccount, getAccounts };