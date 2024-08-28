const express = require('express');
const router = express.Router();
const Book = require('../models/book');
const redisClient = require('../config/redis');
const winston = require('winston');

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

/**
 * @swagger
 * components:
 *   schemas:
 *     Book:
 *       type: object
 *       properties:
 *         title:
 *           type: string
 *           example: "The Great Gatsby"
 *         author:
 *           type: string
 *           example: "F. Scott Fitzgerald"
 *         year:
 *           type: integer
 *           example: 1925
 *         imageUrl:
 *           type: string
 *           example: "http://example.com/image.jpg"
 *         description:
 *           type: string
 *           example: "A classic novel of the Jazz Age."
 *         bookUrl:
 *           type: string
 *           example: "http://example.com/book"
 *       required:
 *         - title
 *         - author
 */

/**
 * @swagger
 * /api/books:
 *   get:
 *     summary: Get all books
 *     responses:
 *       200:
 *         description: List of all books
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Book'
 */
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

/**
 * @swagger
 * /api/books/{id}:
 *   get:
 *     summary: Get a book by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the book
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: A single book
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Book'
 *       404:
 *         description: Book not found
 */
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

/**
 * @swagger
 * /api/books:
 *   post:
 *     summary: Create a new book
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Book'
 *     responses:
 *       201:
 *         description: The created book
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Book'
 */
router.post('/', async (req, res) => {
    const { title, author, year, imageUrl, description, bookUrl } = req.body;
    const book = new Book({
        title,
        author,
        year,
        imageUrl,
        description,
        bookUrl
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

/**
 * @swagger
 * /api/books/{id}:
 *   put:
 *     summary: Update a book by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the book
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Book'
 *     responses:
 *       200:
 *         description: The updated book
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Book'
 *       404:
 *         description: Book not found
 */
router.put('/:id', async (req, res) => {
    try {
        const book = await Book.findByIdAndUpdate(req.params.id, req.body, { new: true });
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

/**
 * @swagger
 * /api/books/{id}:
 *   delete:
 *     summary: Delete a book by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the book
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The deleted book
 *       404:
 *         description: Book not found
 */
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
