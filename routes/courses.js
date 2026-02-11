const express = require('express');
const { getDb, getNextSequence } = require('../database/db');
const { ObjectId } = require('mongodb');

const router = express.Router();

const requireAuth = (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    next();
};

const requireAdmin = (req, res, next) => {
    if (req.session.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    next();
};

const isObjectId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);

const normalizeCourse = (course) => {
    if (!course) return course;
    return {
        ...course,
        id: course.id ?? (course._id ? String(course._id) : course.id),
        _id: course._id ? String(course._id) : undefined,
        createdBy: course.createdBy ? String(course.createdBy) : null
    };
};

const buildCourseSelector = (rawId) => {
    const str = String(rawId).trim();
    if (/^\d+$/.test(str)) return { id: parseInt(str, 10) };
    if (isObjectId(str)) return { _id: new ObjectId(str) };
    return null;
};

const allowedLevels = new Set(['Beginner', 'Intermediate', 'Advanced']);

async function requireOwnerOrAdmin(req, res, next) {
    try {
        const db = getDb();
        const selector = buildCourseSelector(req.params.id);
        if (!selector) return res.status(400).json({ error: 'Invalid ID format' });

        const course = await db.collection('courses').findOne(selector);
        if (!course) return res.status(404).json({ error: 'Course not found' });

        const userId = String(req.session.userId);
        const isAdmin = req.session.role === 'admin';
        const isOwner = course.createdBy && String(course.createdBy) === userId;

        if (!isAdmin && !isOwner) return res.status(403).json({ error: 'Owner access required' });

        req.courseSelector = selector;
        req.courseDoc = course;
        next();
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

router.get('/', async (req, res) => {
    try {
        const db = getDb();
        const { sort, minPrice, maxPrice, page, limit } = req.query;

        const p = Math.max(1, parseInt(page || '1', 10));
        const l = Math.min(100, Math.max(1, parseInt(limit || '20', 10)));

        const query = {};
        const min = minPrice !== undefined ? parseFloat(minPrice) : undefined;
        const max = maxPrice !== undefined ? parseFloat(maxPrice) : undefined;

        if (Number.isFinite(min) || Number.isFinite(max)) {
            query.price = {};
            if (Number.isFinite(min)) query.price.$gte = min;
            if (Number.isFinite(max)) query.price.$lte = max;
        }

        const sortOption = {};
        if (sort) {
            const parts = String(sort).split(':');
            const key = parts[0];
            const dir = parts[1] === 'desc' ? -1 : 1;
            if (key) sortOption[key] = dir;
        } else {
            sortOption.createdAt = -1;
        }

        const total = await db.collection('courses').countDocuments(query);
        const items = await db.collection('courses')
            .find(query)
            .sort(sortOption)
            .skip((p - 1) * l)
            .limit(l)
            .toArray();

        res.status(200).json({
            items: items.map(normalizeCourse),
            page: p,
            limit: l,
            total,
            pages: Math.ceil(total / l)
        });
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const db = getDb();
        const selector = buildCourseSelector(req.params.id);

        if (!selector) return res.status(400).json({ error: 'Invalid ID format' });

        const course = await db.collection('courses').findOne(selector);
        if (!course) return res.status(404).json({ error: 'Course not found' });

        res.status(200).json(normalizeCourse(course));
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/', requireAuth, async (req, res) => {
    try {
        const db = getDb();
        const { title, price, description, instructor, duration, level, category, language } = req.body;

        if (typeof title !== 'string' || title.trim().length === 0) {
            return res.status(400).json({ error: 'Valid title is required' });
        }

        const priceNum = parseFloat(price);
        if (!Number.isFinite(priceNum) || priceNum < 0) {
            return res.status(400).json({ error: 'Valid non-negative price is required' });
        }

        if (typeof instructor !== 'string' || instructor.trim().length === 0) {
            return res.status(400).json({ error: 'Instructor is required' });
        }

        if (typeof category !== 'string' || category.trim().length === 0) {
            return res.status(400).json({ error: 'Category is required' });
        }

        const lvl = typeof level === 'string' && allowedLevels.has(level) ? level : 'Beginner';
        const newId = await getNextSequence('courseId');

        const userId = isObjectId(String(req.session.userId))
            ? new ObjectId(String(req.session.userId))
            : req.session.userId;

        const newCourse = {
            id: newId,
            title: title.trim(),
            price: priceNum,
            description: description !== undefined ? String(description).trim() : '',
            instructor: instructor.trim(),
            duration: duration !== undefined && String(duration).trim().length ? String(duration).trim() : 'TBD',
            level: lvl,
            category: category.trim(),
            language: typeof language === 'string' && language.trim().length ? language.trim() : 'English',
            createdBy: userId,
            createdByUsername: req.session.username || null,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await db.collection('courses').insertOne(newCourse);
        res.status(201).json(normalizeCourse(newCourse));
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.put('/:id', requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
        const db = getDb();
        const { title, price, description, instructor, duration, level, category, language } = req.body;

        const updates = { updatedAt: new Date() };

        if (title !== undefined) {
            if (typeof title !== 'string' || title.trim().length === 0) return res.status(400).json({ error: 'Invalid title' });
            updates.title = title.trim();
        }

        if (price !== undefined) {
            const p = parseFloat(price);
            if (!Number.isFinite(p) || p < 0) return res.status(400).json({ error: 'Invalid price' });
            updates.price = p;
        }

        if (description !== undefined) updates.description = String(description).trim();

        if (instructor !== undefined) {
            if (typeof instructor !== 'string' || instructor.trim().length === 0) return res.status(400).json({ error: 'Invalid instructor' });
            updates.instructor = instructor.trim();
        }

        if (duration !== undefined) updates.duration = String(duration).trim();

        if (level !== undefined) {
            if (typeof level !== 'string' || !allowedLevels.has(level)) return res.status(400).json({ error: 'Invalid level' });
            updates.level = level;
        }

        if (category !== undefined) {
            if (typeof category !== 'string' || category.trim().length === 0) return res.status(400).json({ error: 'Invalid category' });
            updates.category = category.trim();
        }

        if (language !== undefined) updates.language = String(language).trim();

        const result = await db.collection('courses').updateOne(req.courseSelector, { $set: updates });
        if (result.matchedCount === 0) return res.status(404).json({ error: 'Course not found' });

        const updated = await db.collection('courses').findOne(req.courseSelector);
        res.status(200).json(normalizeCourse(updated));
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.delete('/:id', requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
        const db = getDb();
        const result = await db.collection('courses').deleteOne(req.courseSelector);
        if (result.deletedCount === 0) return res.status(404).json({ error: 'Course not found' });

        res.status(200).json({ message: 'Course deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
