const express = require('express');
const { getDb, getNextSequence } = require('../database/db');
const { ObjectId } = require('mongodb');

const router = express.Router();

const requireAdmin = (req, res, next) => {
    if (!req.session.role || req.session.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
    }
    next();
};

const isObjectId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);

const normalizeCourse = (course) => {
    if (!course) return course;
    return {
        ...course,
        id: course.id ?? (course._id ? String(course._id) : course.id)
    };
};

const buildCourseSelector = (rawId) => {
    const str = String(rawId).trim();

    if (/^\d+$/.test(str)) {
        return { id: parseInt(str, 10) };
    }

    if (isObjectId(str)) {
        return { _id: new ObjectId(str) };
    }

    return null;
};

router.get('/', async (req, res) => {
    try {
        const db = getDb();
        const { sort, minPrice, maxPrice } = req.query;

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

        const courses = await db.collection('courses')
            .find(query)
            .sort(sortOption)
            .toArray();

        res.status(200).json(courses.map(normalizeCourse));
    } catch (err) {
        console.error('GET / error:', err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const db = getDb();
        const selector = buildCourseSelector(req.params.id);

        if (!selector) {
            return res.status(400).json({ error: "Invalid ID format" });
        }

        const course = await db.collection('courses').findOne(selector);

        if (!course) {
            return res.status(404).json({ error: "Course not found" });
        }

        res.status(200).json(normalizeCourse(course));
    } catch (err) {
        console.error('GET /:id error:', err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.post('/', async (req, res) => {
    try {
        const db = getDb();
        const { title, price, description } = req.body;

        if (!title || price === undefined || price === null || price === '') {
            return res.status(400).json({ error: "Missing title or price" });
        }

        const newId = await getNextSequence('courseId');

        const newCourse = {
            id: newId,
            title: String(title).trim(),
            price: parseFloat(price),
            description: description ? String(description).trim() : "",
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await db.collection('courses').insertOne(newCourse);

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
        const selector = buildCourseSelector(req.params.id);

        if (!selector) {
            return res.status(400).json({ error: "Invalid ID format" });
        }

        if (!title || price === undefined || price === null || price === '') {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const updates = {
            title: String(title).trim(),
            price: parseFloat(price),
            description: description ? String(description).trim() : "",
            updatedAt: new Date()
        };

        const result = await db.collection('courses').updateOne(
            selector,
            { $set: updates }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: "Course not found" });
        }

        const updated = await db.collection('courses').findOne(selector);
        res.status(200).json(normalizeCourse(updated));
    } catch (err) {
        console.error('PUT /:id error:', err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        const db = getDb();
        const selector = buildCourseSelector(req.params.id);

        if (!selector) {
            return res.status(400).json({ error: "Invalid ID format" });
        }

        const result = await db.collection('courses').deleteOne(selector);

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