const { MongoClient } = require('mongodb');

const url = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const client = new MongoClient(url, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
});

const dbName = process.env.DB_NAME || 'coursemaster_db';
let db;

async function connectToDb() {
    try {
        console.log('Connecting to MongoDB...');

        await client.connect();
        db = client.db(dbName);

        await db.command({ ping: 1 });
        console.log('Connected to MongoDB successfully!');
        console.log('Database:', dbName);

        await initDatabase();

    } catch (err) {
        console.error('MongoDB connection failed:', err.message);
        setTimeout(connectToDb, 5000);
    }
}

async function getNextSequence(name) {
    const result = await db.collection('counters').findOneAndUpdate(
        { _id: name },
        { $inc: { seq: 1 } },
        { returnDocument: 'after', upsert: true }
    );
    return result.seq;
}

async function initDatabase() {
    try {
        const collections = await db.listCollections().toArray();

        const hasCourses = collections.some(col => col.name === 'courses');
        const hasCounters = collections.some(col => col.name === 'counters');

        if (!hasCounters) {
            await db.createCollection('counters');
            await db.collection('counters').insertOne({ _id: 'courseId', seq: 1000 });
            console.log('Created counters collection');
        }

        if (!hasCourses) {
            await db.createCollection('courses');
            console.log('Created courses collection');

            const sampleCourses = [
                {
                    id: 1,
                    title: "Full Stack Web Development",
                    price: 299.99,
                    description: "Learn Node.js, Express, React, MongoDB",
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                {
                    id: 2,
                    title: "Data Science Masterclass",
                    price: 399.99,
                    description: "Python, Pandas, NumPy, Machine Learning",
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                {
                    id: 3,
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

module.exports = { connectToDb, getDb, getNextSequence };