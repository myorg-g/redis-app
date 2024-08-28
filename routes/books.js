const express = require('express');
const router = express.Router();
const Book = require('../models/book');
const redisClient = require('../config/redis');
const winston = require('winston');
const multer = require('multer');
const path = require('path');

// Set up logging
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            ),
        }),
        new winston.transports.File({ filename: 'combined.log' })
    ],
});

// Configure multer for file uploads
const storage = multer.memoryStorage(); // Use memoryStorage for Buffer data
const upload = multer({ storage });

// Middleware to check cache
const checkCache = async (req, res, next) => {
    const { id } = req.params;
    if (id) {
        try {
            const cachedData = await redisClient.get(`book:${id}`);
            if (cachedData) {
                logger.info(`Cache hit for book ID: ${id}`);
                return res.json({ source: 'cache', data: JSON.parse(cachedData) });
            } else {
                logger.info(`Cache miss for book ID: ${id}`);
            }
        } catch (err) {
            logger.error('Redis cache error:', err);
        }
    }
    next();
};

// Get all books route
router.get('/', async (req, res) => {
    try {
        const cachedBooks = await redisClient.get('allBooks');
        if (cachedBooks) {
            logger.info('Cache hit for all books');
            return res.json({ source: 'cache', data: JSON.parse(cachedBooks) });
        }
        logger.info('Cache miss for all books, retrieving from database');
        const books = await Book.find();
        await redisClient.set('allBooks', JSON.stringify(books), 'EX', 3600); // Set cache with expiration of 1 hour
        logger.info('Set cache for all books');
        res.json({ source: 'database', data: books });
    } catch (err) {
        logger.error('Error retrieving all books:', err);
        res.status(500).json({ message: err.message });
    }
});

// Get a book by ID route
router.get('/:id', checkCache, async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (book) {
            await redisClient.set(`book:${req.params.id}`, JSON.stringify(book), 'EX', 3600); // Set cache with expiration of 1 hour
            logger.info(`Updated cache for book with ID: ${req.params.id}`);
            res.json({ source: 'database', data: book });
        } else {
            logger.warn(`Book not found for ID: ${req.params.id}`);
            res.status(404).json({ message: 'Book not found' });
        }
    } catch (err) {
        logger.error(`Error retrieving book with ID: ${req.params.id}`, err);
        res.status(500).json({ message: err.message });
    }
});

// Create a new book with image and PDF upload
router.post('/', upload.fields([{ name: 'image' }, { name: 'pdf' }]), async (req, res) => {
    const { title, author, year, description, bookUrl } = req.body;
    const imageUrl = req.files['image'] ? req.files['image'][0].buffer : null;
    const pdfUrl = req.files['pdf'] ? req.files['pdf'][0].buffer : null;

    const book = new Book({
        title,
        author,
        year,
        description,
        bookUrl: pdfUrl,
        imageUrl: imageUrl
    });

    try {
        const newBook = await book.save();
        await redisClient.del('allBooks'); // Invalidate cache for all books
        logger.info('Created new book:', newBook);
        res.status(201).json(newBook);
    } catch (err) {
        logger.error('Error creating new book:', err);
        res.status(400).json({ message: err.message });
    }
});

// Update a book by ID route
router.put('/:id', upload.fields([{ name: 'image' }, { name: 'pdf' }]), async (req, res) => {
    const { title, author, year, description, bookUrl } = req.body;
    const imageUrl = req.files['image'] ? req.files['image'][0].buffer : null;
    const pdfUrl = req.files['pdf'] ? req.files['pdf'][0].buffer : null;

    try {
        const book = await Book.findByIdAndUpdate(
            req.params.id,
            { title, author, year, description, bookUrl: pdfUrl, imageUrl: imageUrl },
            { new: true }
        );
        if (book) {
            await redisClient.del('allBooks'); // Invalidate cache for all books
            await redisClient.set(`book:${req.params.id}`, JSON.stringify(book), 'EX', 3600); // Update cache
            logger.info('Updated book:', book);
            res.json(book);
        } else {
            logger.warn(`Book not found for ID: ${req.params.id}`);
            res.status(404).json({ message: 'Book not found' });
        }
    } catch (err) {
        logger.error('Error updating book:', err);
        res.status(400).json({ message: err.message });
    }
});

// Delete a book by ID route
router.delete('/:id', async (req, res) => {
    try {
        const book = await Book.findByIdAndDelete(req.params.id);
        if (book) {
            await redisClient.del('allBooks'); // Invalidate cache for all books
            await redisClient.del(`book:${req.params.id}`); // Invalidate cache for single book
            logger.info('Deleted book:', book);
            res.json(book);
        } else {
            logger.warn(`Book not found for ID: ${req.params.id}`);
            res.status(404).json({ message: 'Book not found' });
        }
    } catch (err) {
        logger.error('Error deleting book:', err);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
