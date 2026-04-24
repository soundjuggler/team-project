// this file handles all the data visualization for the analytics page
// storing chart instances to prevent memory leaks when recreating charts


let ratingChartInstance = null; 
let statusChartInstance = null; 
let watchlistGenreChartInstance = null; 
let watchedGenreChartInstance = null; 
let abandonedGenreChartInstance = null; 
let watchedDayChartInstance = null; 
let abandonedDayChartInstance = null; 
// The I will load all analytics data and displaying visualizations
async function loadAnalytics() {
    try {
        const response = await fetch("/api/movies"); 
        const movies = await response.json(); 
        displayCounts(movies); 
        displayStatusChart(movies); 
        displayMustWatch(movies); 
        displayFavorites(movies); 
        displayRatingComparison(movies); 
        displayGenreCharts(movies); 
        displayDayOfWeekCharts(movies); 
    } catch(error) {
        console.error('Error loading analytics:', error); 
    }
}





// Next I will write a function to count movies by status and displaying the counts
// This is basically a numeric summary of the movies I have added to my application 
function displayCounts(movies) {
    const counts = {
        total: movies.length, 
        watchlist: 0, 
        watched: 0, 
        abandoned: 0
    };
    movies.forEach(m => {
        const status = m.status || 'watchlist'; // A validtion point where I will be defaulting to watchlist if status is missing
        counts[status]++; 
    });
    document.getElementById('totalCount').textContent = counts.total; 
    document.getElementById('watchlistCount').textContent = counts.watchlist; 
    document.getElementById('watchedCount').textContent = counts.watched; 
    document.getElementById('abandonedCount').textContent = counts.abandoned; 
}
// Then I will create a horizontal bar chart showing the distribution of movies by status
// this is a visual summary of the status of all my movies in here 

function displayStatusChart(movies) {
    const counts = {
        watchlist: 0, 
        watched: 0, 
        abandoned: 0 
    };
    movies.forEach(m => {
        const status = m.status || 'watchlist'; 
        counts[status]++; 
    });
    const ctx = document.getElementById('statusChart').getContext('2d'); 
    if(statusChartInstance) {
        statusChartInstance.destroy(); 
    }


    statusChartInstance = new Chart(ctx, {
        type: 'bar', // creating a bar chart
        data: {
            labels: ['Watchlist', 'Watched', 'Abandoned'], // defining the labels for each bar
            datasets: [{
                label: 'Movies',
                data: [counts.watchlist, counts.watched, counts.abandoned], 
                backgroundColor: ['#2c3e50', '#34495e', '#7f8c8d'], 
                borderWidth: 0 
            }]
        },
        options: {
            indexAxis: 'y', 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: {
                legend: {
                    display: false 
                }
            },
            scales: {
                x: {
                    beginAtZero: true, 
                    ticks: {
                        stepSize: 1 
                    }
                }
            }
        }
    });
}







// Most movies have more than one genre
// Therefore, if we visualize the genres by status, after a numerous entries, especially on the watched category, then I would be able to see the most prevalent genre combination 
// Displaying genre distribution charts for all three statuses
function displayGenreCharts(movies) {
    const colors = ['#2c3e50','#34495e','#7f8c8d','#95a5a6','#bdc3c7','#ecf0f1','#5d6d7e','#85929e']; 
    displayGenrePieChart(movies,'watchlist','watchlistGenreChart',watchlistGenreChartInstance,colors); 
    displayGenrePieChart(movies,'watched','watchedGenreChart',watchedGenreChartInstance,colors); 
    displayGenrePieChart(movies,'abandoned','abandonedGenreChart',abandonedGenreChartInstance,colors); 
}
// Function for creating a pie chart showing genre distribution for a specific status
function displayGenrePieChart(movies,status,canvasId,chartInstance,colors) {
    const filtered = movies.filter(m => (m.status || 'watchlist') === status); 
    const genreCounts = {}; 
    filtered.forEach(m => {
        const genres = m.genre.split(',').map(g => g.trim()); 
        genres.forEach(genre => {
            genreCounts[genre] = (genreCounts[genre] || 0) + 1; 
        });
    });
    const ctx = document.getElementById(canvasId).getContext('2d'); 
    if(Object.keys(genreCounts).length === 0) {
        if(chartInstance) {
            chartInstance.destroy(); // This will destroy a previous chart instance if it exists
        }
        ctx.canvas.parentElement.innerHTML = '<div class="empty">No movies</div>'; // Making sure that we have a default message if no data
        return;
    }
    const labels = Object.keys(genreCounts); 
    const data = Object.values(genreCounts); 
    if(chartInstance) {
        chartInstance.destroy(); 
    }
    const newChart = new Chart(ctx, {
        type: 'pie', 
        data: {
            labels: labels, 
            datasets: [{
                data: data, 
                backgroundColor: colors.slice(0,labels.length), 
                borderWidth: 1, 
                borderColor: '#fff' 
            }]
        },
        options: {
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: {
                legend: {
                    position: 'bottom', 
                    labels: {
                        boxWidth: 12, 
                        font: {
                            size: 10 
                        }
                    }
                }
            }
        }
    });

    
    if(canvasId === 'watchlistGenreChart') watchlistGenreChartInstance = newChart;
    if(canvasId === 'watchedGenreChart') watchedGenreChartInstance = newChart;
    if(canvasId === 'abandonedGenreChart') abandonedGenreChartInstance = newChart;
}






// The dashboard will 3 movies that have the highest IMBD rating. 
// The reasoning behind this is simple, if  have to decide what to watch I will
// just choose from these three
function displayMustWatch(movies) {
    const watchlist = movies.filter(m => (m.status || 'watchlist') === 'watchlist'); 
    // validating that the IMBD ratings are numbers 
    const sorted = watchlist.sort((a,b) => {
        const ratingA = parseFloat(a.imdbRating) || 0;
        const ratingB = parseFloat(b.imdbRating) || 0; 
        return ratingB - ratingA; 
    });
    const top3 = sorted.slice(0,3); // this will gett only the top 3 movies
    const container = document.getElementById('mustWatch'); 
    if(top3.length === 0) {
        container.innerHTML = '<div class="empty">No movies in watchlist</div>'; 
        return;
    }
    container.innerHTML = top3.map(m => `
        <div class="movie-item">
            <img src="${m.poster}" alt="${m.title}">
            <div class="movie-info">
                <h3>${m.title}</h3>
                <p><strong>Year:</strong> ${m.year}</p>
                <p><strong>Genre:</strong> ${m.genre}</p>
                <p><strong>Director:</strong> ${m.director}</p>
                <p><strong>IMDb Rating:</strong> ${m.imdbRating}</p>
            </div>
        </div>
    `).join(''); // joining all HTML strings
}




// The other side will be mainly for displaying my favourite movies especially if I want to rewatch a movie
// 
// This section will display the top 3 favorite movies based on user ratings

function displayFavorites(movies) {
    const rated = movies.filter(m => m.rating && (m.status === 'watched' || m.status === 'abandoned')); 
    const sorted = rated.sort((a,b) => {
        const ratingA = parseFloat(a.rating) || 0; 
        const ratingB = parseFloat(b.rating) || 0; 
        return ratingB - ratingA; 
    });
    const top3 = sorted.slice(0,3); 
    const container = document.getElementById('favorites'); 
    if(top3.length === 0) {
        container.innerHTML = '<div class="empty">No rated movies yet</div>'; 
        return;
    }
    

    container.innerHTML = top3.map(m => `
        <div class="movie-item">
            <img src="${m.poster}" alt="${m.title}">
            <div class="movie-info">
                <h3>${m.title}</h3>
                <p><strong>IMDb Rating:</strong> ${m.imdbRating}</p>
                <p><strong>My Rating:</strong> ${m.rating}</p>
                <p><strong>Notes:</strong> ${m.notes || 'No notes'}</p>
            </div>
        </div>
    `).join(''); 
}






// The next section will compare how my ratings compare with other ratings that is IMBD movies. 
// The idea behind this is to understand if I should prioritise movies with high IMBD rating 

function displayRatingComparison(movies) {
    const rated = movies.filter(m => m.rating && (m.status === 'watched' || m.status === 'abandoned')); 
    const ctx = document.getElementById('ratingChart').getContext('2d'); 
    if(rated.length === 0) {
        if(ratingChartInstance) {
            ratingChartInstance.destroy(); 
            ratingChartInstance = null;
        }
        ctx.canvas.parentElement.innerHTML = '<div class="empty">No rated movies to compare</div>'; 
        return;
    }
    const labels = rated.map(m => m.title.length > 15 ? m.title.substring(0,15) + '...' : m.title); 
    const myRatings = rated.map(m => parseFloat(m.rating) || 0); 
    const imdbRatings = rated.map(m => parseFloat(m.imdbRating) || 0); 
    if(ratingChartInstance) {
        ratingChartInstance.destroy(); 
    }

    ratingChartInstance = new Chart(ctx, {
        type: 'bar', 
        data: {
            labels: labels, 
            datasets: [
                {
                    label: 'My Rating', 
                    data: myRatings, 
                    backgroundColor: '#000',
                    borderWidth: 0 
                },

                {
                    label: 'IMDb Rating', 
                    data: imdbRatings, 
                    backgroundColor: '#fff', 
                    borderColor: '#2c3e50', 
                    borderWidth: 2 
                }
            ]
        },

        options: {
            responsive: true, 
            maintainAspectRatio: false, 
            scales: {
                y: {
                    beginAtZero: true, 
                    max: 10, 
                    ticks: {
                        stepSize: 2 
                    }
                }
            }
        }
    });
}







//Displaying day of week charts for both watched and abandoned movies
// The insight here is to understand my watching patterns for the various times of the week
// And it will show if I abandon movies based on the day of the week 
function displayDayOfWeekCharts(movies) {
    displayDayOfWeekChart(movies,'watched','watchedDayChart',watchedDayChartInstance); 
    displayDayOfWeekChart(movies,'abandoned','abandonedDayChart',abandonedDayChartInstance); 
}

function displayDayOfWeekChart(movies,status,canvasId,chartInstance) {
    const filtered = movies.filter(m => (m.status || 'watchlist') === status && m.watchedDate); 
    const dayCounts = [0,0,0,0,0,0,0]; // An array to count movies for each day (Sunday=0, Saturday=6)
    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']; 
    filtered.forEach(m => {
        const date = new Date(m.watchedDate); // Converting watchedDate string to Date object
        const dayOfWeek = date.getDay(); // Getting day of week (0=Sunday, 6=Saturday)
        dayCounts[dayOfWeek]++; 
    });
    const ctx = document.getElementById(canvasId).getContext('2d'); 
    if(filtered.length === 0) {
        if(chartInstance) {
            chartInstance.destroy(); 
        }
        ctx.canvas.parentElement.innerHTML = '<div class="empty">No movies</div>'; 
        return;
    }
    if(chartInstance) {
        chartInstance.destroy(); 
    }
    const newChart = new Chart(ctx, {
        type: 'bar', 
        data: {
            labels: dayNames,
            datasets: [{
                label: 'Movies',
                data: dayCounts, 
                backgroundColor: status === 'watched' ? '#34495e' : '#7f8c8d', 
                borderWidth: 0 
            }]
        },
        options: {
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: {
                legend: {
                    display: false // hiding legend since we have labels
                }
            },
            scales: {
                y: {
                    beginAtZero: true, 
                    ticks: {
                        stepSize: 1 
                    }
                }
            }
        }
    });


    
    if(canvasId === 'watchedDayChart') watchedDayChartInstance = newChart;
    if(canvasId === 'abandonedDayChart') abandonedDayChartInstance = newChart;
}
loadAnalytics(); //Then finaly I will automatically loading analytics when the page loads