const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../database/db');

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const db = getDb();
        const { sort, minPrice, maxPrice, fields } = req.query;
        
        let query = {};
        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = parseFloat(minPrice);
            if (maxPrice) query.price.$lte = parseFloat(maxPrice);
        }

        let sortOption = {};
        if (sort) {
            const parts = sort.split(':');
            sortOption[parts[0]] = parts[1] === 'desc' ? -1 : 1;
        }

        let projection = {};
        if (fields) {
            fields.split(',').forEach(field => projection[field] = 1);
        }

        const courses = await db.collection('courses')
            .find(query)
            .sort(sortOption)
            .project(projection)
            .toArray();

        res.status(200).json(courses);
    } catch (err) {
        console.error('GET / error:', err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const db = getDb();
        if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: "Invalid ID format" });
        }
        
        const course = await db.collection('courses').findOne({ _id: new ObjectId(req.params.id) });
        
        if (!course) {
            return res.status(404).json({ error: "Course not found" });
        }
        res.status(200).json(course);
    } catch (err) {
        console.error('GET /:id error:', err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.post('/', async (req, res) => {
    try {
        const db = getDb();
        const { title, price, description } = req.body;

        if (!title || !price) {
            return res.status(400).json({ error: "Missing title or price" });
        }

        const newCourse = {
            title: title.trim(),
            price: parseFloat(price),
            description: description ? description.trim() : "",
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await db.collection('courses').insertOne(newCourse);
        newCourse._id = result.insertedId;
        
        res.status(201).json(newCourse);
    } catch (err) {
        console.error('POST / error:', err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const db = getDb();
        const { title, price, description } = req.body;

        if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: "Invalid ID format" });
        }
        if (!title || !price) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const updates = {
            title: title.trim(),
            price: parseFloat(price),
            description: description ? description.trim() : "",
            updatedAt: new Date()
        };

        const result = await db.collection('courses').updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: updates }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: "Course not found" });
        }

        res.status(200).json({ _id: req.params.id, ...updates });
    } catch (err) {
        console.error('PUT /:id error:', err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const db = getDb();
        if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: "Invalid ID format" });
        }

        const result = await db.collection('courses').deleteOne({ _id: new ObjectId(req.params.id) });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: "Course not found" });
        }

        res.status(200).json({ message: "Course deleted successfully" });
    } catch (err) {
        console.error('DELETE /:id error:', err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = router;