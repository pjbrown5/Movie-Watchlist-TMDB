/**
 * routes/movies.js
 * ----------------
 * Defines:
 * - Endpoints for watchlist movies persisted to /data/movies.json
 * - TMDB-powered search endpoint
 * - Movie detail page renderer (fetches extra info from TMDB)
 */

const express = require("express");
const path = require("path");
const fs = require("fs/promises");
const fetch = require("node-fetch");

const router = express.Router();
const dataFile = path.join(__dirname, "../data/movies.json");

// ---------- Persistence helpers ----------

async function readMovies() {
  try {
    const raw = await fs.readFile(dataFile, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    // If file doesn't exist or is invalid, return empty list
    console.error("Error reading movie data:", err);
    return [];
  }
}

async function writeMovies(movies) {
  try {
    await fs.writeFile(dataFile, JSON.stringify(movies, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing movie data:", err);
    throw err;
  }
}

function nextId(movies) {
  // Safer than movies.length + 1 when deletions exist
  const maxId = movies.reduce((max, m) => Math.max(max, Number(m.id) || 0), 0);
  return maxId + 1;
}

// ---------- TMDB client helpers ----------

function getTMDBAuth() {
  const readToken = process.env.TMDB_READ_TOKEN;
  const apiKey = process.env.TMDB_API_KEY;

  if (readToken) return { type: "bearer", value: readToken };
  if (apiKey) return { type: "apikey", value: apiKey };
  return null;
}

async function tmdbFetchJson(url) {
  const auth = getTMDBAuth();
  if (!auth) {
    return {
      ok: false,
      status: 500,
      error: "TMDB credentials missing (set TMDB_READ_TOKEN or TMDB_API_KEY)."
    };
  }

  const headers = {};
  let finalUrl = url;

  if (auth.type === "bearer") {
    headers.Authorization = `Bearer ${auth.value}`;
  } else {
    // append api_key for v3 auth
    const joiner = finalUrl.includes("?") ? "&" : "?";
    finalUrl = `${finalUrl}${joiner}api_key=${auth.value}`;
  }

  const res = await fetch(finalUrl, { headers });

  if (!res.ok) {
    const text = await res.text();
    return {
      ok: false,
      status: res.status,
      error: text
    };
  }

  const json = await res.json();
  return { ok: true, status: res.status, data: json };
}

// ---------- Routes ----------

/**
 * GET /movies/search?q=...
 * Returns: array of simplified movie objects from TMDB
 */
router.get("/search", async (req, res) => {
  res.set("Cache-Control", "no-store");

  const q = String(req.query.q || "").trim();
  if (q.length < 1) {
    return res.status(400).json({ error: "Search query is required" });
  }

  const url =
    "https://api.themoviedb.org/3/search/movie" +
    `?query=${encodeURIComponent(q)}` +
    "&include_adult=false&language=en-US&page=1";

  const result = await tmdbFetchJson(url);

  if (!result.ok) {
    console.error("TMDB search failed:", result.status, result.error);
    return res.status(502).json({
      error: "TMDB request failed",
      status: result.status,
      details: result.error
    });
  }

  const tmdbResults = Array.isArray(result.data.results) ? result.data.results : [];

  const simplified = tmdbResults.map((movie) => ({
    tmdb_id: movie.id,
    title: movie.title,
    year: movie.release_date ? movie.release_date.split("-")[0] : null,
    poster_path: movie.poster_path,
    overview: movie.overview
  }));

  return res.json(simplified);
});

/**
 * GET /movies/:id
 * Renders movie detail page (server-rendered),
 * enriches saved movie with TMDB details (director/cast/runtime).
 */
router.get("/:id", async (req, res) => {
  const movieId = Number(req.params.id);
  if (!Number.isFinite(movieId)) {
    return res.status(400).render("404", { message: "Invalid movie id", isMovieActive: true });
  }

  const movies = await readMovies();
  const movie = movies.find((m) => Number(m.id) === movieId);

  if (!movie) {
    return res.status(404).render("404", { message: "Movie not found", isMovieActive: true });
  }

  // Only fetch TMDB details if we have a TMDB id
  if (movie.tmdb_id) {
    const url =
      `https://api.themoviedb.org/3/movie/${movie.tmdb_id}` +
      "?append_to_response=credits&language=en-US";

    const result = await tmdbFetchJson(url);

    if (result.ok) {
      const tmdbData = result.data;

      movie.director =
        tmdbData.credits?.crew?.find((member) => member.job === "Director")?.name || "Unknown";

      movie.cast =
        tmdbData.credits?.cast?.slice(0, 3).map((actor) => actor.name).join(", ") || "Unknown";

      movie.runtime = tmdbData.runtime ? `${tmdbData.runtime} minutes` : "Unknown";
    } else {
      console.error("TMDB details failed:", result.status, result.error);
      movie.director = "Unknown";
      movie.cast = "Unknown";
      movie.runtime = "Unknown";
    }
  } else {
    movie.director = "Unknown";
    movie.cast = "Unknown";
    movie.runtime = "Unknown";
  }

  return res.render("movie", { title: movie.title, movie, isMovieActive: true });
});

/**
 * POST /movies
 * Adds a movie to the local watchlist store.
 */
router.post("/", async (req, res) => {
  const movies = await readMovies();

  const tmdb_id = req.body.tmdb_id ?? null;
  const title = String(req.body.title || "").trim();
  const year = req.body.year ? String(req.body.year).trim() : null;
  const poster_path = req.body.poster_path ?? null;
  const overview = req.body.overview ? String(req.body.overview) : "";

  if (!title) {
    return res.status(400).json({ error: "Title is required." });
  }

  // Duplicate prevention (only when tmdb_id is present)
  if (tmdb_id) {
    const exists = movies.some((m) => String(m.tmdb_id) === String(tmdb_id));
    if (exists) {
      return res.status(409).json({ error: "Movie already exists in watchlist." });
    }
  }

  const newMovie = {
    id: nextId(movies),
    tmdb_id: tmdb_id ? Number(tmdb_id) : null,
    title,
    year,
    poster_path,
    overview,
    watched: false,
    watchlist: true,
    liked: false,
    rating: null,
    review: ""
  };

  movies.push(newMovie);
  await writeMovies(movies);

  return res.status(201).json(newMovie);
});

/**
 * PUT /movies/:id
 * Generic partial update (rating, review, flags, etc).
 */
router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "Invalid movie id." });
  }

  const updates = req.body || {};
  const movies = await readMovies();
  const idx = movies.findIndex((m) => Number(m.id) === id);

  if (idx === -1) return res.status(404).json({ error: "Movie not found." });

  movies[idx] = { ...movies[idx], ...updates };
  await writeMovies(movies);

  return res.json(movies[idx]);
});

/**
 * PUT /movies/:id/watched
 * PUT /movies/:id/liked
 * PUT /movies/:id/watchlist
 * Small dedicated endpoints for status toggles.
 */
async function toggleFlag(req, res, flagName) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "Invalid movie id." });
  }

  const movies = await readMovies();
  const movie = movies.find((m) => Number(m.id) === id);
  if (!movie) return res.status(404).json({ error: "Movie not found." });

  const desired = req.body[flagName];
  movie[flagName] = desired !== undefined ? Boolean(desired) : true;

  // - If watched true, auto remove from watchlist
  if (flagName === "watched" && movie.watched) {
    movie.watchlist = false;
  }
  // - If watchlist true, auto mark watched false
  if (flagName === "watchlist" && movie.watchlist) {
    movie.watched = false;
  }

  await writeMovies(movies);
  return res.json({ message: `${flagName} updated`, movie });
}

router.put("/:id/watched", (req, res) => toggleFlag(req, res, "watched"));
router.put("/:id/liked", (req, res) => toggleFlag(req, res, "liked"));
router.put("/:id/watchlist", (req, res) => toggleFlag(req, res, "watchlist"));

/**
 * PUT /movies/:id/review
 * Updates rating + review with basic validation.
 */
router.put("/:id/review", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "Invalid movie id." });
  }

  const ratingRaw = req.body.rating;
  const review = req.body.review ? String(req.body.review) : "";

  const rating = ratingRaw === null || ratingRaw === "" ? null : Number(ratingRaw);
  if (rating !== null && (!Number.isFinite(rating) || rating < 1 || rating > 5)) {
    return res.status(400).json({ error: "Rating must be a number from 1 to 5." });
  }

  const movies = await readMovies();
  const movie = movies.find((m) => Number(m.id) === id);
  if (!movie) return res.status(404).json({ error: "Movie not found." });

  movie.rating = rating;
  movie.review = review;

  await writeMovies(movies);
  return res.json(movie);
});

/**
 * DELETE /movies/:id
 * Removes a movie.
 */
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "Invalid movie id." });
  }

  const movies = await readMovies();
  const filtered = movies.filter((m) => Number(m.id) !== id);

  if (filtered.length === movies.length) {
    return res.status(404).json({ error: "Movie not found." });
  }

  await writeMovies(filtered);
  return res.status(204).send();
});

// Export router + helpers for server-rendered pages
module.exports = router;
module.exports.readMovies = readMovies;
