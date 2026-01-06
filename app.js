/**
 * app.js
 * ------
 * Express server bootstrap:
 * - loads environment variables
 * - configures middleware + view engine
 * - mounts routes
 * - renders pages
 */

require("dotenv").config();

const path = require("path");
const express = require("express");
const exphbs = require("express-handlebars");

const movieRoutes = require("./routes/movies");

const app = express();
const PORT = process.env.PORT || 3000;

/** ---------- Middleware (standard procedure order) ---------- */

// Request logging
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static assets
app.use(express.static(path.join(__dirname, "public")));

/** ---------- View engine (Handlebars) ---------- */

app.engine(
  "hbs",
  exphbs.engine({
    extname: "hbs",
    defaultLayout: "main",
    helpers: {
      eq: (a, b) => a === b
    }
  })
);
app.set("view engine", "hbs");

/** ---------- Routes ---------- */

// API routes + server-rendered movie detail page live in this router
app.use("/movies", movieRoutes);

/**
 * Home: show unwatched movies
 * Keep rendering routes thin: read from route helper and render.
 */
app.get("/", async (req, res, next) => {
  try {
    const movies = await movieRoutes.readMovies();
    const unwatched = movies.filter((m) => !m.watched);
    res.render("index", {
      title: "Movie Watchlist",
      movies: unwatched,
      isHomeActive: true
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Watched page
 */
app.get("/watched", async (req, res, next) => {
  try {
    const movies = await movieRoutes.readMovies();
    const watched = movies.filter((m) => m.watched);
    res.render("watched", {
      title: "Watched Movies",
      movies: watched,
      isWatchedActive: true
    });
  } catch (err) {
    next(err);
  }
});

/** ---------- Error handling (standard procedure) ---------- */

// 404
app.use((req, res) => {
  res.status(404).render("404", { message: "Page not found" });
});

// Central error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);

  // If this was an API request, return JSON
  if (req.path.startsWith("/movies")) {
    return res.status(500).json({ error: "Internal server error" });
  }

  // Otherwise render a friendly page
  res.status(500).render("404", { message: "Something went wrong" });
});

/** ---------- Start server ---------- */

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  if (process.env.NODE_ENV !== "production") {
    console.log("NODE_ENV:", process.env.NODE_ENV || "(not set)");
    console.log("TMDB auth present:", {
      TMDB_READ_TOKEN: !!process.env.TMDB_READ_TOKEN,
      TMDB_API_KEY: !!process.env.TMDB_API_KEY
    });
  }
});
