const { MongoClient } = require('mongodb');

const url = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const client = new MongoClient(url);
const dbName = process.env.DB_NAME || 'coursemaster_db';
let db;

async function connectToDb() {
    try {
        await client.connect();
        db = client.db(dbName);
        console.log('✅ Connected to MongoDB');
        
        const collections = await db.listCollections().toArray();
        const hasCourses = collections.some(col => col.name === 'courses');
        
        if (!hasCourses) {
            await db.createCollection('courses');
            console.log('📚 Created courses collection');
            
            const sampleCourses = [
                { title: "Full Stack Web Development", price: 299.99, description: "Learn MERN stack from scratch", createdAt: new Date() },
                { title: "Data Science with Python", price: 399.99, description: "Master Python for data analysis", createdAt: new Date() },
                { title: "Mobile App Development", price: 249.99, description: "Build iOS & Android apps", createdAt: new Date() },
                { title: "Cybersecurity Fundamentals", price: 349.99, description: "Protect systems from threats", createdAt: new Date() },
                { title: "Cloud Computing with AWS", price: 449.99, description: "Deploy applications on AWS", createdAt: new Date() }
            ];
            
            await db.collection('courses').insertMany(sampleCourses);
            console.log('📝 Inserted sample courses');
        }
        
    } catch (err) {
        console.error('❌ MongoDB connection error:', err);
        process.exit(1);
    }
}

function getDb() {
    if (!db) throw new Error('Database not initialized. Call connectToDb first.');
    return db;
}

module.exports = { connectToDb, getDb };