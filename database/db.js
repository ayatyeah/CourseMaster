const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');

const url = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const client = new MongoClient(url);

const dbName = process.env.DB_NAME || 'coursemaster_db';
let db;

async function connectToDb() {
    try {
        await client.connect();
        db = client.db(dbName);
        await initDatabase();
    } catch (err) {
        console.error(err);
        setTimeout(connectToDb, 5000);
    }
}

async function getNextSequence(name) {
    const res = await db.collection('counters').findOneAndUpdate(
        { _id: name },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: 'after' }
    );

    const doc = res?.value || res;
    if (!doc || typeof doc.seq !== 'number') {
        throw new Error('Counter update failed');
    }

    return doc.seq;
}

async function initDatabase() {
    try {
        const collections = await db.listCollections().toArray();

        if (!collections.some(col => col.name === 'counters')) {
            await db.createCollection('counters');
            await db.collection('counters').insertOne({ _id: 'courseId', seq: 1000 });
        }

        if (!collections.some(col => col.name === 'users')) {
            await db.createCollection('users');
        }

        if (!collections.some(col => col.name === 'courses')) {
            await db.createCollection('courses');
        }

        const seed = String(process.env.SEED_DEMO || '').toLowerCase() === 'true';
        if (!seed) return;

        const existingUsers = await db.collection('users').countDocuments();
        let adminId = null;

        if (existingUsers === 0) {
            const adminPass = process.env.DEMO_ADMIN_PASSWORD || 'admin123';
            const userPass = process.env.DEMO_USER_PASSWORD || 'user123';

            const hashedPasswordAdmin = await bcrypt.hash(adminPass, 10);
            const hashedPasswordUser = await bcrypt.hash(userPass, 10);

            const r = await db.collection('users').insertMany([
                { username: 'admin', password: hashedPasswordAdmin, role: 'admin', createdAt: new Date() },
                { username: 'user', password: hashedPasswordUser, role: 'user', createdAt: new Date() }
            ]);

            adminId = r.insertedIds['0'];
        } else {
            const admin = await db.collection('users').findOne({ role: 'admin' });
            adminId = admin ? admin._id : null;
        }

        if (adminId && !(adminId instanceof ObjectId)) adminId = new ObjectId(String(adminId));

        const coursesCount = await db.collection('courses').countDocuments();
        if (coursesCount < 20) {
            const levels = ['Beginner', 'Intermediate', 'Advanced'];
            const categories = ['Development', 'Business', 'Design', 'Marketing'];
            const courses = [];

            for (let i = 1; i <= 20; i++) {
                courses.push({
                    id: 1000 + i,
                    title: `Course Master Class ${i}`,
                    price: Math.floor(Math.random() * 200) + 10,
                    description: `Comprehensive guide for course ${i}`,
                    instructor: `Instructor ${i}`,
                    duration: `${Math.floor(Math.random() * 40) + 5} hours`,
                    level: levels[Math.floor(Math.random() * levels.length)],
                    category: categories[Math.floor(Math.random() * categories.length)],
                    language: 'English',
                    createdBy: adminId,
                    createdByUsername: 'admin',
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            }

            await db.collection('courses').insertMany(courses);
        }

        if (adminId) {
            await db.collection('courses').updateMany(
                { createdBy: { $exists: false } },
                { $set: { createdBy: adminId, createdByUsername: 'admin' } }
            );
        }
    } catch (err) {
        console.error(err);
    }
}

function getDb() {
    if (!db) throw new Error('Database not initialized');
    return db;
}

module.exports = { connectToDb, getDb, getNextSequence };
