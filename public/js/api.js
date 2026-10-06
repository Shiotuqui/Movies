// Thin client for the Netlify Function. The TMDB key lives only on the server.
import { API_BASE, REGION } from "./config.js";

const TIMEOUT_MS = 15000;

async function request(route, params = {}) {
  const url = new URL(`${API_BASE}/${route}`, window.location.origin);
  url.searchParams.set("region", REGION);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, { signal: controller.signal, headers: { accept: "application/json" } });
  } catch (err) {
    throw new Error(
      err.name === "AbortError" ? "The request took too long. Please try again." : "Network error. Check your connection and try again."
    );
  } finally {
    clearTimeout(timer);
  }

  let body = null;
  try {
    body = await res.json();
  } catch {
    // Non-JSON response (e.g. the function isn't running).
  }
  if (!res.ok || !body) {
    throw new Error((body && body.error) || `Something went wrong (HTTP ${res.status}). Is the Netlify Function running?`);
  }
  return body;
}

export function getProviders() {
  return request("providers");
}

export function discover({ genres, without, services, page, minVotes, count, exclude }) {
  return request("discover", {
    genres,
    // "|" so a movie with ANY excluded genre is dropped.
    without: without && without.length ? without.join("|") : "",
    services: services.join(","),
    page,
    minVotes,
    count,
    exclude: exclude.join(","),
  });
}

export function getMovie(id) {
  return request("movie", { id });
}
