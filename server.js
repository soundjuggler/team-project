// This file helps me define the code for the node.js server with the API endpoints
const http = require('http'); //creating a http server
const { MongoClient } = require('mongodb'); // Getting the databasr drivers
const fs = require('fs'); // This is for file system handling such as html, css and js
const path = require('path'); // manipulation of paths accross different operating systems
const { URL } = require('url'); //for parsing all teh incoming URL requests
const { MONGO_URI, OMDB_API_KEY } = require('./config'); // impoting the configuration 
console.log("Config loaded");
console.log("  MONGO_URI:", MONGO_URI ? "Present" : "MISSING");
console.log("  OMDB_API_KEY:", OMDB_API_KEY ? "Present" : "MISSING");


let mongodb_client;


// Creating a database connection which will re-use a previous mongodb connection 
// if the connection is available
// it will return a database instance 
async function getDB() {
    if (!mongodb_client) {
        console.log("Connecting to MongoDB");
        mongodb_client = new MongoClient(MONGO_URI);
        await mongodb_client.connect();
        console.log("MongoDB connected");
    }
    return mongodb_client.db();
}



function serveStaticFile(req, res) {
    const safePath = req.url === "/" ? "index.html" : req.url;// maping the index.html to be our home page 
    const filePath = path.join(__dirname, "public", safePath); // creatubf a safe path that will prevent directory traversal attacks
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            return res.end("404 File Not Found");
        }
        const ext = path.extname(filePath);

        //creatin content headers for the most common content types 
        // the aim si to ensure that the browser is able to interpret the files correctly
        
        const contentTypes = {
            ".html": "text/html",
            ".css": "text/css",
            ".js": "application/javascript",
            ".png": "image/png",
            ".jpg": "image/jpeg"
        };
        res.writeHead(200, { "Content-Type": contentTypes[ext] || "text/plain" });// default to text for any other extensiin 
        res.end(data);
    });
}




// The app uses data from an external source ie it uses the OMBD API
// A key element that I pt in place is to ensure that I have validated all the data
// This ensures that we have clean data for subsequent operations  
async function searchOMDB(title) {
    const cleanedTitle = title.trim().toLowerCase(); // Sanitizing the input by removing xtra spaces and converting the input to lowercase 
    const apiUrl = `http://www.omdbapi.com/?apikey=${OMDB_API_KEY}&t=${encodeURIComponent(cleanedTitle)}`; // this helps handle any specual characters when we are making teh requests syc as Avengers:Endgame
    console.log("Calling OMDb API");

    // sending the API and then I verify if the movies exist
    // We cannot add  a movies that does not exist
    //If the movie exists then the next step will be to validate if it has all the relevant data
    const response = await fetch(apiUrl); 
    const data = await response.json();
    console.log("OMDb response:", data.Response === "True" ? `Found: ${data.Title}` : data.Error);
    return data;
}





// this function validates all the fields that I will store in the database

function validateMovieData(movieData) {
    const validations = [];
    if (!movieData.Title || movieData.Title === "N/A") {
        validations.push("title");
    }
    if (!movieData.Year || movieData.Year === "N/A") {
        validations.push("year");
    }
    if (!movieData.Genre || movieData.Genre === "N/A") {
        validations.push("genre");
    }
    if (!movieData.Director || movieData.Director === "N/A") {
        validations.push("director");
    }
    if (!movieData.Runtime || movieData.Runtime === "N/A") {
        validations.push("runtime");
    }
    if (!movieData.imdbRating || movieData.imdbRating === "N/A") {
        validations.push("IMDb rating");
    }
    if (!movieData.Poster || movieData.Poster === "N/A") {
        validations.push("poster");
    }
    return validations;
}





const server = http.createServer(async (req, res) => {
    const parsed = new URL(req.url, `http://${req.headers.host}`);
    
    if (req.method === "GET" && !parsed.pathname.startsWith("/api")) {
        return serveStaticFile(req, res);
    }
    // retrieving all the movies from the database 
    if (req.method === "GET" && parsed.pathname === "/api/movies") {
        try {
            const db = await getDB();
            // This will return all the movies as A JSON response. T
            // The movies will be sorted in a descending order

            const movies = await db.collection("movies").find().sort({ createdAt: -1 }).toArray(); 
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify(movies));
        } catch (err) {//for error handlig 
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: err.message }));
        }
    }
    if (req.method === "POST" && parsed.pathname === "/api/addMovie") {
        console.log("POST /api/addMovie received");
        let body = "";
        req.on("data", chunk => (body += chunk));
        req.on("end", async () => {
            try {
                console.log("Body received:", body);
                const { title } = JSON.parse(body);
                console.log("Title:", title);
                const cleanedTitle = title.trim().toLowerCase();
                // validating to ensure that we do not send in a blank title 
                if (!cleanedTitle) {
                    console.log("Empty title");
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ error: "Movie title cannot be empty." }));
                }
                //checking for existence 
                const movieData = await searchOMDB(cleanedTitle);
                if (movieData.Response === "False") {
                    console.log("Movie not found in OMDb");
                    res.writeHead(400, { "Content-Type": "application/json" });
                    // Providing a user friend error 
                    return res.end(JSON.stringify({error: "Movie not found. Check spelling or try another title."}));
                }

                // Validating that all teh movies will have all the required fields 
                // If there is a field that is missing, then the application will provide specific feedback on which fields are missing 
                const missingFields = validateMovieData(movieData);
                if (missingFields.length > 0) {
                    console.log("Missing fields:", missingFields.join(", "));
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({
                        error: `Movie found but missing required information: ${missingFields.join(", ")}.`
                    }));
                }
                // Ensuring that we can only add movies that have been released
                const currentYear = new Date().getFullYear();
                const movieYear = parseInt(movieData.Year);
                if (isNaN(movieYear) || movieYear > currentYear) {
                    console.log("Invalid or future release year");
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({error: "Movie has invalid year or not yet released."}));
                }

                //validaiting to ensure that we cannot add a movie that is already in the database 
                console.log("Checking for duplicates...");
                const db = await getDB();
                // Checking to ensure that we have only one title. 
                // We will do a REGEX exact mathc
                // and the search will be case insisnsitve 
                const existing = await db.collection("movies").findOne({
                    title: { $regex: new RegExp(`^${movieData.Title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
                });
                if (existing) {
                    console.log("Duplicate movie found");
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ error: "This movie is already in your watchlist." }));
                }
                console.log("Saving to MongoDB...");
                await db.collection("movies").insertOne({
                    title: movieData.Title,
                    year: movieData.Year,
                    genre: movieData.Genre,
                    director: movieData.Director,
                    runtime: movieData.Runtime,
                    poster: movieData.Poster,
                    imdbRating: movieData.imdbRating,
                    status: "watchlist", // this will be the default statys
                    // adding these fields later using forms 
                    rating: null,
                    watchedDate: null, 
                    notes: null,
                    createdAt: new Date()
                });
                console.log("Movie saved successfully");
                res.writeHead(200, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({message: "Movie added successfully.",movie: movieData}));
            } catch (err) {
                console.error("ERROR:", err.message);
                console.error("Stack:", err.stack);
                res.writeHead(500, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ error: "Server error", details: err.message }));
            }
        });
        return;
    }






    // Updating movie information 
    if (req.method === "PUT" && parsed.pathname.startsWith("/api/updateMovie/")) {
        const movieId = parsed.pathname.split("/").pop(); // will get the last item in the UrL which is the movie ID
        console.log("PUT /api/updateMovie received for ID:", movieId);
        let body = "";
        req.on("data", chunk => (body += chunk));
        req.on("end", async () => {
            try {
                const updates = JSON.parse(body);
                console.log("Updates:", updates);
                const db = await getDB();
                const { ObjectId } = require('mongodb');
                const updateFields = {};
                // only supposed to update the required fields only. 
                if (updates.status !== undefined) updateFields.status = updates.status;
                if (updates.rating !== undefined) updateFields.rating = updates.rating;
                if (updates.watchedDate !== undefined) updateFields.watchedDate = updates.watchedDate ? new Date(updates.watchedDate) : null;
                if (updates.notes !== undefined) updateFields.notes = updates.notes;
                // updting just one single document matching the criteria withour replacing the enyire documenr 
                const result = await db.collection("movies").updateOne(
                    { _id: new ObjectId(movieId) },
                    { $set: updateFields }
                );
                if (result.matchedCount === 0) {
                    res.writeHead(404, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ error: "Movie not found" }));
                }
                console.log("Movie updated successfully");
                res.writeHead(200, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ message: "Movie updated successfully" }));
            } catch (err) {
                console.error("ERROR:", err.message);
                res.writeHead(500, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ error: "Server error", details: err.message }));
            }
        });
        return;
    }





    
    // Deleting a single document and then verigying if the deletion has occured
    if (req.method === "DELETE" && parsed.pathname.startsWith("/api/deleteMovie/")) {
        const movieId = parsed.pathname.split("/").pop();
        console.log("DELETE /api/deleteMovie received for ID:", movieId);
        try {
            const db = await getDB();
            const { ObjectId } = require('mongodb');
            const result = await db.collection("movies").deleteOne({ _id: new ObjectId(movieId) });
            if (result.deletedCount === 0) {
                res.writeHead(404, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ error: "Movie not found" }));
            }
            console.log("Movie deleted successfully");
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ message: "Movie deleted successfully" }));
        } catch (err) {
            console.error("ERROR:", err.message);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Server error", details: err.message }));
        }
    }
    serveStaticFile(req, res);
});
server.listen(3000, () => {
    console.log("Server running at http://localhost:3000");
});