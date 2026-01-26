const express = require('express');
const session = require('express-session');
const path = require('path');
const { connectToDb } = require('./database/db');
const coursesRoutes = require('./routes/courses');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(session({
    secret: 'coursemaster-secret-key-12345',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        return res.redirect('/login.html');
    }
    next();
};

const requireAdmin = (req, res, next) => {
    if (!req.session.userId || req.session.role !== 'admin') {
        return res.status(403).send('Admin access required');
    }
    next();
};

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} | User: ${req.session.userId || 'guest'}`);
    next();
});

app.use('/api/auth', authRoutes);
app.use('/api/courses', requireAuth, coursesRoutes);

app.get('/login.html', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/contact', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'contact.html'));
});

app.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'about.html'));
});

app.get('/', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/admin', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'admin.html'));
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
        res.json({
            status: 'healthy',
            database: 'connected',
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development'
        });
    } catch (err) {
        res.status(500).json({
            status: 'unhealthy',
            database: 'disconnected',
            error: err.message,
            timestamp: new Date().toISOString()
        });
    }
});

app.use((req, res) => {
    if (req.url.startsWith('/api')) {
        res.status(404).json({ error: "API endpoint not found" });
    } else {
        res.status(404).sendFile(path.join(__dirname, 'views', '404.html'));
    }
});

connectToDb().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Login: http://localhost:${PORT}/login.html`);
        console.log(`Admin Dashboard: http://localhost:${PORT}/admin`);
        console.log(`API Base URL: http://localhost:${PORT}/api/courses`);
        console.log(`Health Check: http://localhost:${PORT}/health`);
    });
}).catch(err => {
    console.error('Database connection failed:', err.message);
    app.listen(PORT, () => {
        console.log(`Server running (NO DATABASE) on port ${PORT}`);
    });
});