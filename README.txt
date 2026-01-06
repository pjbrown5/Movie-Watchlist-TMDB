# Movie Watchlist

A Node.js + Express watchlist app that lets you:
- search movies via TMDB
- add movies to your watchlist
- mark movies as watched
- leave a rating (1–5) and review
- view a movie detail page with director/cast/runtime pulled from TMDB

## Tech Stack
- Node.js, Express
- Handlebars (server-rendered views)
- TMDB API (search + movie details)
- JSON file persistence (`data/movies.json`)

## Setup

### 1) Install dependencies
```bash
npm install

# Start and stop

npm start

Follow the link in the terminal

npx kill-port 3000