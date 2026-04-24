// This files will serve as the client side JS for movie crud opertions and also validations


// I will be using global state mangement 
let currentMovieId = null; 
let originalStatus = null; 
let originalData = {}; 
let allMovies = []; 


//Adding a movie
// The idea here is simple that we have a field for recording errors 
// It will also enables us to preview the movie that was just added
async function addMovie(event) {
    event.preventDefault(); // prevents the form from submitting in the traditional way
    const movieTitle = document.getElementById('movieTitle').value; 
    const responseMessage = document.getElementById('responseMessage'); 
    const recentMovie = document.getElementById('recent-movie'); 
    responseMessage.textContent = ''; 
    if(recentMovie) recentMovie.innerHTML = ''; 
    try {
        const response = await fetch("/api/addMovie", { 
            method: "POST",
            headers: {"Content-Type": "application/json"}, 
            body: JSON.stringify({ title: movieTitle }) 
        });
        const data = await response.json(); 
        if (!response.ok) {
            responseMessage.textContent = `Error: ${data.error}`; 
        } else {
            responseMessage.textContent = `Success: Movie "${data.movie.Title}" added!`; 
            document.getElementById('movieTitle').value = ''; 
            if(recentMovie) {
                recentMovie.innerHTML = `
                    <div class="movie-card">
                        <img src="${data.movie.Poster}" alt="${data.movie.Title}">
                        <h3>${data.movie.Title}</h3>
                        <p><strong>Year:</strong> ${data.movie.Year}</p>
                        <p><strong>Genre:</strong> ${data.movie.Genre}</p>
                        <p><strong>Director:</strong> ${data.movie.Director}</p>
                    </div>
                `;
            }
        }
    } catch (error) {
        responseMessage.textContent = `Error: ${error.message}`; 
    }
}





// In the homepage, I will loading all movies from the database and displaying them
async function loadMovies() {
    const response = await fetch("/api/movies"); 
    allMovies = await response.json(); 
    applyFilters(); // This will apply filters and sort to alter how the movies are displayed
}
// Defining a function for filtering the movies 
function applyFilters() {
    const statusFilter = document.getElementById('statusFilter')?.value || 'all'; 
    const sortBy = document.getElementById('sortBy')?.value || 'date-desc'; 
    let filtered = [...allMovies]; 
    if(statusFilter !== 'all') {
        filtered = filtered.filter(m => (m.status || 'watchlist') === statusFilter); 
    }
    filtered.sort((a,b) => { 
        if(sortBy === 'date-desc') {
            return new Date(b.createdAt) - new Date(a.createdAt); 
        } else if(sortBy === 'date-asc') {
            return new Date(a.createdAt) - new Date(b.createdAt); 
        } else if(sortBy === 'year-asc') {
            return parseInt(a.year) - parseInt(b.year); 
        } else if(sortBy === 'year-desc') {
            return parseInt(b.year) - parseInt(a.year); 
        } else if(sortBy === 'rating-asc') {
            return (parseFloat(a.imdbRating) || 0) - (parseFloat(b.imdbRating) || 0); 
        } else if(sortBy === 'rating-desc') {
            return (parseFloat(b.imdbRating) || 0) - (parseFloat(a.imdbRating) || 0); 
        }
        return 0; 
    });
    const container = document.getElementById("movies-container"); 
    if(filtered.length === 0) {
        container.innerHTML = '<p>No movies found.</p>'; 
        return;
    }
   

    container.innerHTML = filtered.map(m => `
        <div class="movie-card" onclick="openMovieModal('${m._id}')">
            <div class="movie-card-inner">
                <div class="status-badge status-${m.status || 'watchlist'}">${m.status || 'watchlist'}</div>
                <img src="${m.poster}" alt="${m.title}">
                <div class="movie-overlay"></div>
            </div>
            <h3>${m.title}</h3>
            <p><strong>Year:</strong> ${m.year}</p>
            <p><strong>Genre:</strong> ${m.genre}</p>
            <p><strong>Director:</strong> ${m.director}</p>
        </div>
    `).join(""); 
}







// If I want to edit or delete a movie we should do this through a pop up 
async function openMovieModal(id) {
    currentMovieId = id; // Storing the movie ID for later use in update and delete operations
    try {
        const response = await fetch("/api/movies");
        const movies = await response.json();
        const movie = movies.find(m => m._id === id); 
        if(!movie) {
            alert('Movie not found'); 
            return;
        }
        document.getElementById('modalTitle').textContent = movie.title; 
        document.getElementById('modalYear').textContent = movie.year; 
        document.getElementById('modalGenre').textContent = movie.genre; 
        document.getElementById('modalDirector').textContent = movie.director; 
        document.getElementById('modalRuntime').textContent = movie.runtime; 
        document.getElementById('modalImdbRating').textContent = movie.imdbRating; 
        const posterImg = document.getElementById('modalPoster');
        if(posterImg) posterImg.src = movie.poster; 
        document.getElementById('modalStatus').value = movie.status || 'watchlist'; 
        originalStatus = movie.status || 'watchlist'; 
        document.getElementById('modalRating').value = movie.rating || ''; 
        document.getElementById('modalWatchedDate').value = movie.watchedDate ? movie.watchedDate.split('T')[0] : ''; 
        document.getElementById('modalNotes').value = movie.notes || ''; 
        originalData = { 
            status: movie.status || 'watchlist',
            rating: movie.rating || '',
            watchedDate: movie.watchedDate ? movie.watchedDate.split('T')[0] : '',
            notes: movie.notes || ''
        };
        document.getElementById('updateBtn').disabled = true; // Disabling update button since no changes have been made yet
        document.getElementById('deleteBtn').disabled = false; //enabling delete button
        toggleUserFields(); //showing or hiding user input fields based on status
        document.getElementById('movieModal').style.display = 'flex'; 
    } catch(error) {
        alert(`Error: ${error.message}`); 
    }
}
function closeMovieModal() {
    document.getElementById('movieModal').style.display = 'none'; 
    currentMovieId = null; 
    originalStatus = null; 
    originalData = {}; 
}



// If we change the status we should display the user field and then disable the delete button , while enabling the update button. 
function onStatusChange() {
    const currentStatus = document.getElementById('modalStatus').value; 
    if((originalStatus === 'watched' || originalStatus === 'abandoned') && currentStatus === 'watchlist') {
        // If a user changes from watched/abandoned back to watchlist, It will clear the user input fields
        document.getElementById('modalRating').value = '';
        document.getElementById('modalWatchedDate').value = '';
        document.getElementById('modalNotes').value = '';
    }
    checkForChanges(); 
    toggleUserFields(); 
}


// Handling other field changes
// The aim is to ensure that the app listens when there are changes in any of the fields
//this will inform which button should be active, delete or update
function onFieldChange() {
    checkForChanges(); 
}
function checkForChanges() {
    const currentStatus = document.getElementById('modalStatus').value; 
    const currentRating = document.getElementById('modalRating').value; 
    const currentDate = document.getElementById('modalWatchedDate').value; 
    const currentNotes = document.getElementById('modalNotes').value; 
    const statusChanged = currentStatus !== originalData.status; 
    const ratingChanged = currentRating !== (originalData.rating || '').toString(); 
    const dateChanged = currentDate !== originalData.watchedDate; 
    const notesChanged = currentNotes !== originalData.notes; 
    const hasChanges = statusChanged || ratingChanged || dateChanged || notesChanged; 
    document.getElementById('updateBtn').disabled = !hasChanges; 
    document.getElementById('deleteBtn').disabled = hasChanges; 
}



// Validating the rating input to ensure it stays within 1-10 range
function validateRating() {
    const ratingInput = document.getElementById('modalRating');
    const value = parseFloat(ratingInput.value); 
    if(ratingInput.value && value < 1) {
        ratingInput.value = 1; 
    } else if(ratingInput.value && value > 10) {
        ratingInput.value = 10; 
    }
}


//validating to date watched to ensure it is not in the future
function validateDate() {
    const dateInput = document.getElementById('modalWatchedDate');
    const selectedDate = new Date(dateInput.value); 
    const today = new Date();
    today.setHours(0,0,0,0); 
    if(selectedDate > today) {
        alert('Date watched cannot be in the future'); 
        dateInput.value = ''; 
    }
}





function toggleUserFields() {
    const status = document.getElementById('modalStatus').value; 
    const fields = document.getElementById('userFields'); 
    const rating = document.getElementById('modalRating');
    const date = document.getElementById('modalWatchedDate');
    const notes = document.getElementById('modalNotes');
    if(status === 'watched' || status === 'abandoned') {
        fields.style.display = 'block'; 
        rating.required = true; 
        date.required = true; 
        notes.required = true; 
    } else {
        fields.style.display = 'none'; 
        rating.required = false; 
        date.required = false; 
        notes.required = false; 
    }
}




// updating movie information in the database
async function updateMovie() {
    if(!currentMovieId) return; 
    const status = document.getElementById('modalStatus').value; 
    const rating = document.getElementById('modalRating').value; 
    const watchedDate = document.getElementById('modalWatchedDate').value; 
    const notes = document.getElementById('modalNotes').value.trim(); 
    if(status === 'watched' || status === 'abandoned') {
        // Validating required fields for watched and abandoned status
        if(!rating || parseFloat(rating) < 1 || parseFloat(rating) > 10) {
            alert('Rating must be between 1 and 10'); 
            return;
        }
        if(!watchedDate) {
            alert('Date watched is required'); 
            return;
        }
        const selectedDate = new Date(watchedDate);
        const today = new Date();
        today.setHours(0,0,0,0); 
        if(selectedDate > today) {
            alert('Date watched cannot be in the future'); 
            return;
        }
        if(!notes) {
            alert('Notes cannot be empty'); 
            return;
        }
    }
    try {
        const response = await fetch(`/api/updateMovie/${currentMovieId}`, { 
            method: "PUT",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ 
                status,
                rating: rating ? parseFloat(rating) : null, 
                watchedDate: watchedDate || null, 
                notes: notes || null 
            })
        });
        const data = await response.json();
        if(response.ok) {
            closeMovieModal(); 
            loadMovies(); 
        } else {
            alert(`Error: ${data.error}`); 
        }
    } catch(error) {
        alert(`Error: ${error.message}`); 
    }
}



// confirming and deleting a movie from the database
async function confirmDelete() {
    if(!currentMovieId) return; 
    const title = document.getElementById('modalTitle').textContent; 
    if(!confirm(`Are you sure you want to delete "${title}"?`)) {
        return; 
    }
    try {
        const response = await fetch(`/api/deleteMovie/${currentMovieId}`, {method: "DELETE"}); 
        const data = await response.json();
        if(response.ok) {
            closeMovieModal(); 
            loadMovies(); 
        } else {
            alert(`Error: ${data.error}`); 
        }
    } catch(error) {
        alert(`Error: ${error.message}`); 
    }
}

if (window.location.pathname.includes("index.html") || window.location.pathname === "/") {
    loadMovies(); 
}