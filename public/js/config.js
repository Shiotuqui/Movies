// Streaming region (ISO 3166-1 country code). Change it here and the whole app follows:
// provider lookup, discover filtering and "Where to watch" all use this value.
export const REGION = "US";

// Movies with fewer votes than this are skipped to avoid obscure or unreliable picks.
export const MIN_VOTES = 150;

// How many movies to show per mood / per "Show me others" click.
export const RESULTS_PER_PAGE = 6;

// TMDB's discover endpoint never serves pages beyond 500.
export const MAX_PAGE = 500;

// Base path for the Netlify Function proxy (see netlify.toml).
export const API_BASE = "/api";

// The four supported services, in display order. Keys must match the
// Netlify Function (netlify/functions/tmdb.js).
export const SERVICE_KEYS = ["netflix", "paramount", "disney", "prime"];
