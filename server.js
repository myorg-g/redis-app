require('dotenv').config(); // Load environment variables from .env file
const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerJsDoc = require('swagger-jsdoc');
const bookRoutes = require('./routes/books');
const winston = require('winston');
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

const app = express();

// CORS configuration using express middleware for greater control
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*'); // Allow all origins or specify allowed origins
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200); // Preflight request handling
    }
    next();
});

app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Swagger setup
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Book Management API',
            version: '1.0.0',
            description: 'API for managing books with caching using Redis',
        },
        servers: [
            {
                url: 'http://localhost:3000/', // Adjust this if necessary
            },
        ],
    },
    apis: ['./routes/books.js'], // Path to the API docs
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Routes
app.use('/api/books', bookRoutes);

// Handle base URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Database connection
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
    logger.error('MongoDB URI is not set in environment variables');
    process.exit(1);
}

mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => logger.info('Connected to MongoDB'))
.catch(err => logger.error('Error connecting to MongoDB:', err));

const PORT = process.env.PORT || 3000; // Default to 3000 if PORT is not defined

app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
});
