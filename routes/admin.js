const express = require('express');
const { getDb } = require('../database/db');
const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');

const router = express.Router();

const requireAuth = (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    next();
};

const requireAdmin = (req, res, next) => {
    if (req.session.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    next();
};

const safeUser = (u) => ({
    id: String(u._id),
    username: u.username,
    role: u.role,
    createdAt: u.createdAt || null
});

router.get('/users', requireAuth, requireAdmin, async (req, res) => {
    try {
        const db = getDb();
        const users = await db.collection('users')
            .find({}, { projection: { password: 0 } })
            .sort({ createdAt: -1 })
            .toArray();
        res.json({ items: users.map(safeUser) });
    } catch (e) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/users', requireAuth, requireAdmin, async (req, res) => {
    try {
        const db = getDb();
        const { username, password, role } = req.body;

        if (typeof username !== 'string' || username.trim().length < 2) return res.status(400).json({ error: 'Invalid username' });
        if (typeof password !== 'string' || password.length < 4) return res.status(400).json({ error: 'Invalid password' });

        const r = role === 'admin' ? 'admin' : 'user';
        const uname = username.trim();

        const exists = await db.collection('users').findOne({ username: uname });
        if (exists) return res.status(409).json({ error: 'Username already exists' });

        const hash = await bcrypt.hash(password, 10);
        const doc = { username: uname, password: hash, role: r, createdAt: new Date() };
        const result = await db.collection('users').insertOne(doc);

        res.status(201).json({ user: { id: String(result.insertedId), username: uname, role: r } });
    } catch (e) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.put('/users/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const db = getDb();
        const { id } = req.params;
        if (!/^[a-f\d]{24}$/i.test(String(id))) return res.status(400).json({ error: 'Invalid ID' });

        const { username, role, password } = req.body;

        const updates = {};
        if (username !== undefined) {
            if (typeof username !== 'string' || username.trim().length < 2) return res.status(400).json({ error: 'Invalid username' });
            updates.username = username.trim();
        }
        if (role !== undefined) {
            updates.role = role === 'admin' ? 'admin' : 'user';
        }
        if (password !== undefined && String(password).length) {
            if (typeof password !== 'string' || password.length < 4) return res.status(400).json({ error: 'Invalid password' });
            updates.password = await bcrypt.hash(password, 10);
        }

        if (!Object.keys(updates).length) return res.status(400).json({ error: 'No updates provided' });

        if (updates.username) {
            const exists = await db.collection('users').findOne({ username: updates.username, _id: { $ne: new ObjectId(id) } });
            if (exists) return res.status(409).json({ error: 'Username already exists' });
        }

        const result = await db.collection('users').findOneAndUpdate(
            { _id: new ObjectId(id) },
            { $set: updates },
            { returnDocument: 'after', projection: { password: 0 } }
        );

        const user = result.value;
        if (!user) return res.status(404).json({ error: 'User not found' });

        res.json({ user: safeUser(user) });
    } catch (e) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.delete('/users/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const db = getDb();
        const { id } = req.params;
        if (!/^[a-f\d]{24}$/i.test(String(id))) return res.status(400).json({ error: 'Invalid ID' });

        if (String(req.session.userId) === String(id)) {
            return res.status(400).json({ error: 'Cannot delete yourself' });
        }

        const target = await db.collection('users').findOne({ _id: new ObjectId(id) });
        if (!target) return res.status(404).json({ error: 'User not found' });

        if (target.role === 'admin') {
            const admins = await db.collection('users').countDocuments({ role: 'admin' });
            if (admins <= 1) return res.status(400).json({ error: 'Cannot delete last admin' });
        }

        await db.collection('users').deleteOne({ _id: new ObjectId(id) });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
