# Movie Watchlist

A server-rendered **Node.js and Express** web application that allows users to manage a personal movie watchlist using data from **The Movie Database (TMDB) API**.

The application supports searching for movies, tracking watched status, and leaving ratings and short reviews, with persistent storage using a JSON file.

---

## Features

- Search movies using the TMDB API
- Add movies to a personal watchlist
- Mark movies as watched or unwatched
- Leave a rating (1–5) and short review
- View detailed movie information including director, cast, and runtime

---

## Technologies Used

- **Node.js**
- **Express**
- **Handlebars** (server-rendered views)
- **TMDB API** (movie search and metadata)
- **JSON file persistence** (`data/movies.json`)

---

## Setup & Running the Application

### 1. Install dependencies
```bash
npm install

In the .env file in the project root, add a line that says:

TMDB_API_KEY=your_api_read_access_token_here

Get your API access token from https://developer.themoviedb.org/docs/getting-started. Follow the directions onscreen to get your access token.

Start the server with npm start. 

The application will run on http://localhost:3000

Kill it with npx kill-port 3000





