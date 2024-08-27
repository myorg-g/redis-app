require('dotenv').config(); // Load environment variables from .env file
const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerJsDoc = require('swagger-jsdoc');
const bookRoutes = require('./routes/books');
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

const app = express();

// CORS configuration
app.use(cors({
    origin: '*', // Allow all origins for testing; adjust as needed
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

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
                url: 'http://localhost:5000/api', // Adjust this if necessary
            },
        ],
    },
    apis: ['./routes/books.js'], // Path to the API docs
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Routes
app.use('/api/books', bookRoutes);

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

// Start server
app.listen(5000, () => {
    logger.info('Server is running on port 5000');
});
