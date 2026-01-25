const { MongoClient } = require('mongodb');

const url = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const client = new MongoClient(url);

const dbName = process.env.DB_NAME || 'coursemaster_db';
let db;

async function connectToDb() {
    try {
        console.log('Connecting to MongoDB Atlas...');
        console.log('URL:', process.env.MONGODB_URI ? 'Set' : 'Not set');

        await client.connect();
        db = client.db(dbName);

        await db.command({ ping: 1 });
        console.log('Connected to MongoDB Atlas successfully!');
        console.log('Database:', dbName);

        await initDatabase();

    } catch (err) {
        console.error('MongoDB connection failed:', err.message);
        if (err.message.includes('Authentication failed')) {
            console.error('Check username/password in MONGODB_URI');
        }
        if (err.message.includes('ENOTFOUND')) {
            console.error('Check network connection and hostname');
        }
    }
}

async function initDatabase() {
    try {
        const collections = await db.listCollections().toArray();
        console.log('Collections found:', collections.length);

        const hasCourses = collections.some(col => col.name === 'courses');

        if (!hasCourses) {
            await db.createCollection('courses');
            console.log('Created courses collection');

            const sampleCourses = [
                {
                    title: "Full Stack Web Development",
                    price: 299.99,
                    description: "Learn Node.js, Express, React, MongoDB",
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                {
                    title: "Data Science Masterclass",
                    price: 399.99,
                    description: "Python, Pandas, NumPy, Machine Learning",
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                {
                    title: "Mobile App Development",
                    price: 249.99,
                    description: "Build iOS & Android apps with React Native",
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ];

            const result = await db.collection('courses').insertMany(sampleCourses);
            console.log(`Added ${result.insertedCount} sample courses`);

        } else {
            const count = await db.collection('courses').countDocuments();
            console.log(`Found ${count} existing courses`);
        }

    } catch (err) {
        console.error('Database initialization error:', err.message);
    }
}

function getDb() {
    if (!db) throw new Error('Database not initialized');
    return db;
}

module.exports = { connectToDb, getDb };