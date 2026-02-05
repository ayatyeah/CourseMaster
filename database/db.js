const { MongoClient } = require('mongodb');
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
    const result = await db.collection('counters').findOneAndUpdate(
        { _id: name },
        { $inc: { seq: 1 } },
        { returnDocument: 'after', upsert: true }
    );
    if (!result.value) throw new Error('Counter update failed');
    return result.value.seq;
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
            const hashedPasswordAdmin = await bcrypt.hash('admin123', 10);
            const hashedPasswordUser = await bcrypt.hash('user123', 10);

            await db.collection('users').insertMany([
                { username: 'admin', password: hashedPasswordAdmin, role: 'admin' },
                { username: 'user', password: hashedPasswordUser, role: 'user' }
            ]);
        }

        if (!collections.some(col => col.name === 'courses')) {
            await db.createCollection('courses');

            const courses = [];
            const levels = ['Beginner', 'Intermediate', 'Advanced'];
            const categories = ['Development', 'Business', 'Design', 'Marketing'];

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
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            }

            await db.collection('courses').insertMany(courses);
        } else {
            const count = await db.collection('courses').countDocuments();
            if (count < 20) {
                const courses = [];
                const levels = ['Beginner', 'Intermediate', 'Advanced'];
                const categories = ['Development', 'Business', 'Design', 'Marketing'];

                for (let i = 1; i <= 20; i++) {
                    courses.push({
                        id: 2000 + i,
                        title: `Extra Course ${i}`,
                        price: 99.99,
                        description: `Additional content ${i}`,
                        instructor: `Teacher ${i}`,
                        duration: `10 hours`,
                        level: levels[0],
                        category: categories[0],
                        language: 'English',
                        createdAt: new Date(),
                        updatedAt: new Date()
                    });
                }

                await db.collection('courses').insertMany(courses);
            }
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
