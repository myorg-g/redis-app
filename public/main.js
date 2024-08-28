// Fetch all books and display them in a table
function fetchBooks() {
    fetch('/api/books')
        .then(response => response.json())
        .then(data => {
            const booksTableBody = document.getElementById('books');
            booksTableBody.innerHTML = ''; // Clear previous entries
            data.data.forEach(book => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${book.title}</td>
                    <td>${book.author}</td>
                    <td>${book.year}</td>
                    <td>${book.image ? `<img src="${book.image}" alt="Book Image" width="50">` : 'No Image'}</td>
                    <td>${book.description || 'No Description'}</td>
                `;
                booksTableBody.appendChild(row);
            });
        })
        .catch(error => console.error('Error fetching books:', error));
}

// Add a new book
document.getElementById('add-book-form').addEventListener('submit', function(event) {
    event.preventDefault();
    const title = document.getElementById('title').value;
    const author = document.getElementById('author').value;
    const year = document.getElementById('year').value;
    const imageFile = document.getElementById('image').files[0];
    const url = document.getElementById('url').value;
    const description = document.getElementById('description').value;

    // Check for duplicate title
    fetch('/api/books')
        .then(response => response.json())
        .then(data => {
            const duplicate = data.data.find(book => book.title.toLowerCase() === title.toLowerCase());
            if (duplicate) {
                alert('A book with this title already exists.');
            } else {
                const formData = new FormData();
                formData.append('title', title);
                formData.append('author', author);
                formData.append('year', year);
                if (imageFile) {
                    formData.append('image', imageFile);
                }
                if (url) {
                    formData.append('url', url);
                }
                if (description) {
                    formData.append('description', description);
                }

                fetch('/api/books', {
                    method: 'POST',
                    body: formData,
                })
                .then(response => response.json())
                .then(data => {
                    console.log('Book added:', data);
                    fetchBooks(); // Refresh the list of books
                })
                .catch(error => console.error('Error adding book:', error));
            }
        });
});

// Search for books by title or author in real-time
function searchBooks() {
    const searchTerm = document.getElementById('search-term').value.toLowerCase();
    fetch('/api/books')
        .then(response => response.json())
        .then(data => {
            const booksTableBody = document.getElementById('books');
            booksTableBody.innerHTML = ''; // Clear previous results
            const filteredBooks = data.data.filter(book =>
                book.title.toLowerCase().includes(searchTerm) ||
                book.author.toLowerCase().includes(searchTerm)
            );
            if (filteredBooks.length > 0) {
                filteredBooks.forEach(book => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${book.title}</td>
                        <td>${book.author}</td>
                        <td>${book.year}</td>
                        <td>${book.image ? `<img src="${book.image}" alt="Book Image" width="50">` : 'No Image'}</td>
                        <td>${book.description || 'No Description'}</td>
                    `;
                    booksTableBody.appendChild(row);
                });
            } else {
                const row = document.createElement('tr');
                row.innerHTML = '<td colspan="5">No books found</td>';
                booksTableBody.appendChild(row);
            }
        })
        .catch(error => console.error('Error searching books:', error));
}
