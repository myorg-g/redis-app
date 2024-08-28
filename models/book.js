const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
    title: { type: String, required: true },
    author: { type: String, required: true },
    year: { type: Number, required: true },
    imageUrl: { type: String, default: '' }, // Optional field for image URL
    description: { type: String, default: '' }, // Optional field for book description
    bookUrl: { type: String, default: '' } // Optional field for external book URL
});

module.exports = mongoose.model('Book', bookSchema);
