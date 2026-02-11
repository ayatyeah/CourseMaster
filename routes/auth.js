const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');
const bcrypt = require('bcryptjs');

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const db = getDb();

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    try {
        const user = await db.collection('users').findOne({ username });

        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

        req.session.regenerate((err) => {
            if (err) return res.status(500).json({ error: 'Session error' });

            req.session.userId = String(user._id);
            req.session.username = user.username;
            req.session.role = user.role;

            req.session.save((err) => {
                if (err) return res.status(500).json({ error: 'Session save error' });
                res.json({
                    success: true,
                    user: {
                        id: String(user._id),
                        username: user.username,
                        role: user.role
                    }
                });
            });
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) return res.status(500).json({ error: 'Logout failed' });
        res.clearCookie('connect.sid');
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

module.exports = router;
