const express = require('express');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const path = require('path');
const { connectToDb } = require('./database/db');
const coursesRoutes = require('./routes/courses');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/coursemaster_db';

const store = new MongoDBStore({
    uri: MONGODB_URI,
    collection: 'sessions'
});

store.on('error', (error) => console.log(error));

app.set('trust proxy', 1);

app.use(session({
    secret: process.env.SESSION_SECRET || 'coursemaster-secret-key-12345',
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
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/courses', coursesRoutes);

const requirePageAuth = (req, res, next) => {
    if (!req.session.userId) return res.redirect('/login.html');
    next();
};

app.get('/login.html', (req, res) => {
    if (req.session.userId) return res.redirect('/');
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/', requirePageAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/api/me', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
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
