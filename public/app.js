/**
 * public/app.js
 * -------------
 * Client-side behavior:
 * - debounced TMDB search via our server (/movies/search)
 * - render results
 * - add movie to watchlist
 */

let searchTimeout;

const searchInput = document.getElementById("search");
const resultsDiv = document.getElementById("search-results");

if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);

    const query = e.target.value.trim();

    if (query.length < 2) {
      clearResults();
      return;
    }

    searchTimeout = setTimeout(() => doSearch(query), 300);
  });
}

function clearResults() {
  if (resultsDiv) resultsDiv.innerHTML = "";
}

function setMessage(msg) {
  clearResults();
  const p = document.createElement("p");
  p.textContent = msg;
  resultsDiv.appendChild(p);
}

async function doSearch(query) {
  try {
    const url = `/movies/search?q=${encodeURIComponent(query)}&_=${Date.now()}`;
    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Search failed ${response.status}: ${text}`);
    }

    const movies = await response.json();

    clearResults();

    if (!Array.isArray(movies) || movies.length === 0) {
      setMessage("No results found.");
      return;
    }

    // Render results
    movies.forEach((movie, index) => {
      resultsDiv.appendChild(buildResultRow(movie, index, movies));
    });
  } catch (err) {
    console.error("Error searching movies:", err);
    setMessage("Error searching movies.");
  }
}

function buildResultRow(movie, index, movies) {
  const row = document.createElement("div");
  row.className = "search-result";

  const content = document.createElement("div");
  content.className = "search-result-content";

  // Poster
  if (movie.poster_path) {
    const img = document.createElement("img");
    img.className = "search-poster";
    img.alt = `${movie.title || "Movie"} poster`;
    img.src = `https://image.tmdb.org/t/p/w92${movie.poster_path}`;
    content.appendChild(img);
  }

  // Details container
  const details = document.createElement("div");
  details.className = "search-details";

  // Title line
  const strong = document.createElement("strong");
  const year = movie.year || "N/A";
  strong.textContent = `${movie.title || "Untitled"} (${year})`;
  details.appendChild(strong);

  // Overview preview
  const p = document.createElement("p");
  const overview = movie.overview || "No overview available.";
  p.textContent = overview.length > 100 ? overview.slice(0, 100) + "..." : overview;
  details.appendChild(p);

  // Add button
  const btn = document.createElement("button");
  btn.className = "add-movie-btn";
  btn.textContent = "Add to Watchlist";
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    await addMovie(movies[index]);
    btn.disabled = false;
  });

  details.appendChild(btn);
  content.appendChild(details);
  row.appendChild(content);

  return row;
}

async function addMovie(movie) {
  try {
    const response = await fetch("/movies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tmdb_id: movie.tmdb_id ?? null,
        title: movie.title ?? "",
        year: movie.year ?? null,
        poster_path: movie.poster_path ?? null,
        overview: movie.overview ?? ""
      })
    });

    if (response.ok) {
      window.location.reload();
      return;
    }

    // Helpful messages for common cases
    const text = await response.text();
    if (response.status === 409) {
      alert("That movie is already in your watchlist.");
    } else {
      alert(`Failed to add movie (${response.status}).`);
      console.error("Add movie failed:", text);
    }
  } catch (err) {
    console.error("Error adding movie:", err);
    alert("Error adding movie. Please try again.");
  }
}

// Handlers

async function markWatched(id) {
  try {
    const response = await fetch(`/movies/${id}/watched`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ watched: true })
    });

    if (!response.ok) throw new Error("Failed to mark watched");
    location.reload();
  } catch (err) {
    console.error("Error marking movie as watched:", err);
    alert("Failed to mark movie as watched");
  }
}

async function deleteMovie(id) {
  try {
    const response = await fetch(`/movies/${id}`, { method: "DELETE" });
    if (!response.ok) throw new Error("Failed to delete");
    window.location.reload();
  } catch (err) {
    console.error("Error deleting movie:", err);
    alert("Failed to delete movie");
  }
}

async function submitRating(id) {
  const ratingEl = document.getElementById(`rating-${id}`);
  const reviewEl = document.getElementById(`review-${id}`);

  const rating = ratingEl ? ratingEl.value : "";
  const review = reviewEl ? reviewEl.value : "";

  const n = Number(rating);
  if (!rating || !Number.isFinite(n) || n < 1 || n > 5) {
    alert("Please enter a rating between 1 and 5");
    return;
  }

  try {
    const response = await fetch(`/movies/${id}/review`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: n, review })
    });

    if (!response.ok) throw new Error("Failed to submit review");
    window.location.reload();
  } catch (err) {
    console.error("Error submitting rating/review:", err);
    alert("Failed to submit rating/review");
  }
}

async function updateStatus(statusType, id, checked) {
  try {
    const response = await fetch(`/movies/${id}/${statusType}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [statusType]: checked })
    });

    if (!response.ok) throw new Error(`Failed to update ${statusType}`);
    window.location.reload();
  } catch (err) {
    console.error(`Error updating ${statusType} status:`, err);
    alert(`Failed to update ${statusType} status`);
  }
}

window.addMovie = addMovie;
window.markWatched = markWatched;
window.deleteMovie = deleteMovie;
window.submitRating = submitRating;
window.updateStatus = updateStatus;
