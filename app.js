const express = require('express');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { connectToDb } = require('./database/db');
const coursesRoutes = require('./routes/courses');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/coursemaster_db';
const SESSION_SECRET = process.env.SESSION_SECRET;

if (process.env.NODE_ENV === 'production' && !SESSION_SECRET) {
    console.error('Missing SESSION_SECRET in production');
    process.exit(1);
}

const store = new MongoDBStore({
    uri: MONGODB_URI,
    collection: 'sessions'
});

store.on('error', (error) => console.log(error));

app.set('trust proxy', 1);

app.use(helmet());
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '25kb' }));

const loginLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false
});

app.use('/api/auth/login', loginLimiter);

app.use(session({
    secret: SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    store,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

app.use(express.static('public'));

app.use('/api/auth', authRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/admin', adminRoutes);

const requirePageAuth = (req, res, next) => {
    if (!req.session.userId) return res.redirect('/login.html');
    next();
};

const requirePageAdmin = (req, res, next) => {
    if (!req.session.userId) return res.redirect('/login.html');
    if (req.session.role !== 'admin') return res.status(403).sendFile(path.join(__dirname, 'views', '404.html'));
    next();
};

app.get('/login.html', (req, res) => {
    if (req.session.userId) return res.redirect('/');
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/', requirePageAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/admin', requirePageAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

app.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'about.html'));
});

app.get('/contact', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'contact.html'));
});

app.post('/contact', (req, res) => {
    res.status(200).json({ success: true, message: 'Message received' });
});

app.get('/api/me', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    res.json({
        id: String(req.session.userId),
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

app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'views', '404.html'));
});

connectToDb().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on port ${PORT}`);
    });
}).catch(err => {
    console.error('Database connection failed:', err.message);
    process.exit(1);
});
