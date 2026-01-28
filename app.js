const express = require('express');
const session = require('express-session');
const path = require('path');
const { connectToDb } = require('./database/db');
const coursesRoutes = require('./routes/courses');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

app.use(session({
    secret: process.env.SESSION_SECRET || 'coursemaster-secret-key-12345',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} | User: ${req.session.userId || 'guest'}`);
    next();
});

const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        if (req.xhr || req.headers.accept?.includes('json')) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        return res.redirect('/login.html');
    }
    next();
};

app.use('/api/auth', authRoutes);
app.use('/api/courses', requireAuth, coursesRoutes);

app.get('/login.html', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/api/me', requireAuth, (req, res) => {
    res.json({
        id: req.session.userId,
        username: req.session.username,
        role: req.session.role
    });
});

app.get('/health', async (req, res) => {
    try {
        const { getDb } = require('./database/db');
        const db = getDb();
        await db.command({ ping: 1 });
        res.json({ status: 'healthy', database: 'connected' });
    } catch (err) {
        res.status(500).json({ status: 'unhealthy', database: 'disconnected' });
    }
});

connectToDb().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on port ${PORT}`);
    });
}).catch(err => {
    console.error('Database connection failed:', err.message);
    process.exit(1);
});