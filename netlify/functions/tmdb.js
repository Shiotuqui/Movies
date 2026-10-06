// Mood Reel — TMDB proxy.
// Every TMDB request goes through here so the API key never reaches the browser.
// Routes (via the /api/* redirect in netlify.toml):
//   GET /api/providers?region=US
//   GET /api/discover?region=US&genres=35|10751&without=27&services=netflix,prime&page=1&minVotes=150&count=6&exclude=1,2,3
//   GET /api/movie?id=550&region=US

const TMDB_BASE = "https://api.themoviedb.org/3";
const LANGUAGE = "en-US";
const IMAGE_BASE = "https://image.tmdb.org/t/p/";

// The four supported services. Provider IDs are NOT hard-coded: they are resolved
// at runtime from TMDB's /watch/providers/movie list by matching normalized names.
// Several TMDB entries can belong to one service (e.g. "Netflix" and
// "Netflix basic with Ads"), so each service collects every matching ID.
const SERVICES = [
  { key: "netflix", name: "Netflix", canonical: "netflix" },
  { key: "paramount", name: "Paramount+", canonical: "paramount plus" },
  { key: "disney", name: "Disney+", canonical: "disney plus" },
  { key: "prime", name: "Prime Video", canonical: "amazon prime video" },
];

const PROVIDER_CACHE_TTL = 12 * 60 * 60 * 1000;
const providerCache = new Map(); // region -> { at, services }

function normalizeProviderName(name) {
  return String(name)
    .toLowerCase()
    .replace(/\+/g, " plus ")
    .replace(/\b(with ads|with showtime|basic|standard|premium|essential)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function tmdb(path, params, apiKey) {
  const url = new URL(TMDB_BASE + path);
  const headers = { accept: "application/json" };
  // Accept either a v4 "API Read Access Token" (a JWT) or a classic v3 API key.
  if (apiKey.startsWith("eyJ")) headers.authorization = `Bearer ${apiKey}`;
  else url.searchParams.set("api_key", apiKey);
  url.searchParams.set("language", LANGUAGE);
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    if (res.status === 401) throw new HttpError(502, "TMDB rejected the API key. Check TMDB_API_KEY.");
    if (res.status === 404) throw new HttpError(404, "Not found on TMDB.");
    if (res.status === 429) throw new HttpError(503, "TMDB rate limit reached. Please try again in a moment.");
    throw new HttpError(502, `TMDB request failed (${res.status}).`);
  }
  return res.json();
}

async function getServices(region, apiKey) {
  const cached = providerCache.get(region);
  if (cached && Date.now() - cached.at < PROVIDER_CACHE_TTL) return cached.services;

  const data = await tmdb("/watch/providers/movie", { watch_region: region }, apiKey);
  const services = SERVICES.map((s) => ({ ...s, ids: [], logo: null, _logoId: Infinity }));

  for (const p of data.results || []) {
    // Skip add-on channels sold through another store (e.g. "Paramount+ Amazon Channel").
    if (/channel/i.test(p.provider_name)) continue;
    const service = services.find((s) => s.canonical === normalizeProviderName(p.provider_name));
    if (!service) continue;
    service.ids.push(p.provider_id);
    // The lowest ID is the original listing (e.g. Netflix = 8); use its logo.
    if (p.provider_id < service._logoId && p.logo_path) {
      service._logoId = p.provider_id;
      service.logo = IMAGE_BASE + "w92" + p.logo_path;
    }
  }

  const result = services.map(({ key, name, ids, logo }) => ({ key, name, ids, logo }));
  providerCache.set(region, { at: Date.now(), services: result });
  return result;
}

function servicesForFlatrate(flatrate, services) {
  const ids = new Set((flatrate || []).map((p) => p.provider_id));
  return services.filter((s) => s.ids.some((id) => ids.has(id))).map((s) => s.key);
}

function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function yearOf(date) {
  return date ? Number(String(date).slice(0, 4)) || null : null;
}

function img(size, path) {
  return path ? IMAGE_BASE + size + path : null;
}

function intParam(value, fallback, min, max) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function genreParam(value) {
  if (!value) return "";
  if (!/^[\d|,]+$/.test(value)) throw new HttpError(400, "Invalid genre list.");
  return value;
}

async function handleProviders(region, apiKey) {
  const services = await getServices(region, apiKey);
  return { region, services: services.map(({ key, name, logo, ids }) => ({ key, name, logo, available: ids.length > 0 })) };
}

async function handleDiscover(q, region, apiKey) {
  const page = intParam(q.page, 1, 1, 500);
  const count = intParam(q.count, 6, 1, 20);
  const minVotes = intParam(q.minVotes, 150, 0, 100000);
  const requested = String(q.services || "").split(",").filter(Boolean);
  const exclude = new Set(String(q.exclude || "").split(",").filter(Boolean).map(Number));

  const services = await getServices(region, apiKey);
  const selected = services.filter((s) => requested.includes(s.key) && s.ids.length > 0);
  if (selected.length === 0) return { page, totalPages: 0, totalResults: 0, results: [] };

  const data = await tmdb(
    "/discover/movie",
    {
      include_adult: "false",
      include_video: "false",
      sort_by: "popularity.desc",
      with_genres: genreParam(q.genres),
      without_genres: genreParam(q.without),
      watch_region: region,
      // "|" = OR: a movie on any one of the selected services qualifies.
      with_watch_providers: selected.flatMap((s) => s.ids).join("|"),
      with_watch_monetization_types: "flatrate",
      "vote_count.gte": minVotes,
      page,
    },
    apiKey
  );

  const candidates = shuffle((data.results || []).filter((m) => !exclude.has(m.id)));
  const selectedKeys = new Set(selected.map((s) => s.key));
  const picked = [];
  let i = 0;

  // Confirm availability per movie (and learn which of the four services carry it).
  while (picked.length < count && i < candidates.length) {
    const batch = candidates.slice(i, i + (count - picked.length));
    i += batch.length;
    const providers = await Promise.all(
      batch.map((m) => tmdb(`/movie/${m.id}/watch/providers`, {}, apiKey).catch(() => null))
    );
    batch.forEach((m, j) => {
      const regional = providers[j] && providers[j].results && providers[j].results[region];
      const keys = servicesForFlatrate(regional && regional.flatrate, services);
      if (!keys.some((k) => selectedKeys.has(k))) return;
      picked.push({
        id: m.id,
        title: m.title,
        year: yearOf(m.release_date),
        rating: Math.round((m.vote_average || 0) * 10) / 10,
        voteCount: m.vote_count || 0,
        overview: m.overview || "",
        poster: img("w342", m.poster_path),
        services: keys,
      });
    });
  }

  return {
    page,
    totalPages: Math.min(data.total_pages || 0, 500),
    totalResults: data.total_results || 0,
    results: picked,
  };
}

function pickTrailer(videos) {
  const yt = (videos && videos.results ? videos.results : []).filter((v) => v.site === "YouTube" && v.key);
  const rank = (v) => (v.type === "Trailer" ? 0 : v.type === "Teaser" ? 2 : 4) + (v.official ? 0 : 1);
  const best = yt.filter((v) => v.type === "Trailer" || v.type === "Teaser").sort((a, b) => rank(a) - rank(b))[0];
  return best ? { key: best.key, name: best.name } : null;
}

async function handleMovie(q, region, apiKey) {
  const id = intParam(q.id, NaN, 1, Number.MAX_SAFE_INTEGER);
  if (Number.isNaN(id)) throw new HttpError(400, "Invalid movie id.");

  const [m, services] = await Promise.all([
    tmdb(`/movie/${id}`, { append_to_response: "videos,watch/providers" }, apiKey),
    getServices(region, apiKey),
  ]);
  const regional = m["watch/providers"] && m["watch/providers"].results && m["watch/providers"].results[region];

  return {
    id: m.id,
    title: m.title,
    tagline: m.tagline || "",
    year: yearOf(m.release_date),
    runtime: m.runtime || null,
    rating: Math.round((m.vote_average || 0) * 10) / 10,
    voteCount: m.vote_count || 0,
    genres: (m.genres || []).map((g) => g.name),
    overview: m.overview || "",
    poster: img("w500", m.poster_path),
    backdrop: img("w1280", m.backdrop_path),
    trailer: pickTrailer(m.videos),
    services: servicesForFlatrate(regional && regional.flatrate, services),
    watchLink: (regional && regional.link) || null,
  };
}

function json(status, body, maxAge = 0) {
  return {
    statusCode: status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": maxAge ? `public, max-age=${maxAge}` : "no-store",
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") return json(405, { error: "Method not allowed." });

  const apiKey = (process.env.TMDB_API_KEY || "").trim();
  if (!apiKey) {
    return json(500, { error: "The server is missing TMDB_API_KEY. Add it to your .env file or Netlify environment variables." });
  }

  const match = String(event.path || "").match(/\/(?:api|tmdb)\/([a-z]+)\/?$/);
  const route = match ? match[1] : "";
  const q = event.queryStringParameters || {};
  const region = String(q.region || "US").toUpperCase();
  if (!/^[A-Z]{2}$/.test(region)) return json(400, { error: "Invalid region. Use a 2-letter country code." });

  try {
    switch (route) {
      case "providers":
        return json(200, await handleProviders(region, apiKey), 3600);
      case "discover":
        return json(200, await handleDiscover(q, region, apiKey), 300);
      case "movie":
        return json(200, await handleMovie(q, region, apiKey), 3600);
      default:
        return json(404, { error: "Unknown endpoint." });
    }
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 502;
    const message = err instanceof HttpError ? err.message : "Could not reach TMDB. Please try again.";
    return json(status, { error: message });
  }
};

// Exposed for local testing only.
exports._internals = { normalizeProviderName, pickTrailer, providerCache };
