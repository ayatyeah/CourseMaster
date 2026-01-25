const express = require('express');
const path = require('path');
const { connectToDb, getDb } = require('./database/db');
const coursesRoutes = require('./routes/courses');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

app.use('/api/courses', coursesRoutes);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

app.get('/contact', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'contact.html'));
});

app.get('/health', async (req, res) => {
    try {
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