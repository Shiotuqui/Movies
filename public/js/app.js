import { REGION, MIN_VOTES, RESULTS_PER_PAGE, MAX_PAGE, SERVICE_KEYS } from "./config.js";
import { MOODS, GENRE_NAMES, genreQuery } from "./moods.js";
import * as api from "./api.js";
import * as ui from "./ui.js";

const STORAGE_KEY = "moodreel.services";
const MAX_EXCLUDE = 300; // keep the query string short
const DEFAULT_ACCENT = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#e50914";

const $ = (sel) => document.querySelector(sel);
const els = {
  home: $("#home-link"),
  moodScreen: $("#screen-mood"),
  resultsScreen: $("#screen-results"),
  moodGrid: $("#mood-grid"),
  back: $("#btn-back"),
  title: $("#results-title"),
  sub: $("#results-sub"),
  chips: $("#service-chips"),
  chipsHint: $("#chips-hint"),
  status: $("#results-status"),
  grid: $("#results-grid"),
  others: $("#btn-others"),
  modal: $("#modal"),
  modalBody: $("#modal-body"),
  region: $("#footer-region"),
};

const state = {
  mood: null,
  services: [], // [{ key, name, logo, available }]
  servicesByKey: new Map(),
  selected: loadSelected(),
  totalPages: 0,
  visitedPages: new Set(),
  seenIds: [],
  loadToken: 0,
  lastFocus: null,
  providersPromise: null,
};

/* ---------- Persistence (best effort) ---------- */

function loadSelected() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const valid = Array.isArray(saved) ? saved.filter((k) => SERVICE_KEYS.includes(k)) : [];
    if (valid.length) return new Set(valid);
  } catch {
    /* ignore */
  }
  return new Set(SERVICE_KEYS);
}

function saveSelected() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.selected]));
  } catch {
    /* ignore */
  }
}

/* ---------- Providers ---------- */

function loadProviders() {
  if (!state.providersPromise) {
    state.providersPromise = api
      .getProviders()
      .then((data) => {
        const byKey = new Map(data.services.map((s) => [s.key, s]));
        state.services = SERVICE_KEYS.map((k) => byKey.get(k)).filter(Boolean);
        state.servicesByKey = new Map(state.services.map((s) => [s.key, s]));
        // Drop services that don't exist in this region; fall back to all available ones.
        const available = state.services.filter((s) => s.available).map((s) => s.key);
        const kept = [...state.selected].filter((k) => available.includes(k));
        state.selected = new Set(kept.length ? kept : available);
        renderChips();
        return state.services;
      })
      .catch((err) => {
        state.providersPromise = null; // allow retry
        throw err;
      });
  }
  return state.providersPromise;
}

function renderChips() {
  ui.renderChips(els.chips, state.services, state.selected, toggleService);
}

function toggleService(key) {
  if (state.selected.has(key)) {
    if (state.selected.size === 1) {
      flashHint("Keep at least one service selected.");
      return;
    }
    state.selected.delete(key);
  } else {
    state.selected.add(key);
  }
  flashHint("");
  saveSelected();
  renderChips();
  if (state.mood) startFresh();
}

let hintTimer;
function flashHint(text) {
  clearTimeout(hintTimer);
  els.chipsHint.textContent = text;
  if (text) hintTimer = setTimeout(() => (els.chipsHint.textContent = ""), 3000);
}

/* ---------- Screens & accent ---------- */

function setAccent(color) {
  document.documentElement.style.setProperty("--accent", color);
}

function showScreen(screen) {
  const [show, hide] = screen === "results" ? [els.resultsScreen, els.moodScreen] : [els.moodScreen, els.resultsScreen];
  if (!hide.hidden) {
    hide.classList.add("is-leaving");
    setTimeout(() => {
      hide.hidden = true;
      hide.classList.remove("is-leaving");
      show.hidden = false;
      window.scrollTo(0, 0);
    }, 220);
  } else {
    show.hidden = false;
  }
}

function pickMood(mood) {
  state.mood = mood;
  setAccent(mood.accent);
  els.title.textContent = `${mood.emoji} Feeling ${mood.label.toLowerCase()}`;
  const genres = mood.genres.map((id) => GENRE_NAMES[id] || id).join(mood.match === "all" ? " + " : " · ");
  els.sub.textContent = `${mood.tagline} ${genres} — streaming in ${REGION}.`;
  showScreen("results");
  startFresh();
}

function goHome() {
  state.mood = null;
  state.loadToken++;
  setAccent(DEFAULT_ACCENT);
  showScreen("mood");
  closeModal();
}

/* ---------- Loading results ---------- */

function startFresh() {
  state.totalPages = 0;
  state.visitedPages = new Set();
  state.seenIds = [];
  loadPage(1);
}

function randomUnvisitedPage() {
  const max = Math.min(state.totalPages, MAX_PAGE);
  if (max <= 0) return 1;
  if (state.visitedPages.size >= max) {
    // Everything has been shown: start a new cycle.
    state.visitedPages = new Set();
    state.seenIds = [];
  }
  const options = [];
  for (let p = 1; p <= max; p++) if (!state.visitedPages.has(p)) options.push(p);
  return options[Math.floor(Math.random() * options.length)];
}

async function fetchPage(page, count) {
  state.visitedPages.add(page);
  const data = await api.discover({
    genres: genreQuery(state.mood),
    without: state.mood.exclude,
    services: [...state.selected],
    page,
    minVotes: MIN_VOTES,
    count,
    exclude: state.seenIds.slice(-MAX_EXCLUDE),
  });
  state.totalPages = data.totalPages;
  return data.results;
}

async function loadPage(page) {
  const token = ++state.loadToken;
  setBusy(true);
  ui.renderStatus(els.status, {});
  ui.renderSkeletons(els.grid, RESULTS_PER_PAGE);

  try {
    await loadProviders();
    if (token !== state.loadToken) return;

    let movies = await fetchPage(page, RESULTS_PER_PAGE);
    // Top up from one more page if this one was thin (small pages or already-seen movies).
    if (movies.length < RESULTS_PER_PAGE && state.visitedPages.size < Math.min(state.totalPages, MAX_PAGE)) {
      if (token !== state.loadToken) return;
      state.seenIds.push(...movies.map((m) => m.id));
      const more = await fetchPage(randomUnvisitedPage(), RESULTS_PER_PAGE - movies.length);
      const ids = new Set(movies.map((m) => m.id));
      movies = movies.concat(more.filter((m) => !ids.has(m.id)));
    }
    if (token !== state.loadToken) return;

    state.seenIds.push(...movies.map((m) => m.id));

    if (!movies.length) {
      els.grid.replaceChildren();
      els.others.hidden = true;
      ui.renderStatus(els.status, {
        kind: "empty",
        title: "No movies found",
        message:
          state.selected.size < state.services.filter((s) => s.available).length
            ? "Nothing matched this mood on the services you selected. Try turning on more services or pick another mood."
            : "Nothing matched this mood right now. Try another mood.",
        actionLabel: "Pick another mood",
        onAction: goHome,
      });
      return;
    }

    ui.renderCards(els.grid, movies, state.servicesByKey, (m) => openModal(m.id));
    els.others.hidden = false;
  } catch (err) {
    if (token !== state.loadToken) return;
    els.grid.replaceChildren();
    els.others.hidden = true;
    ui.renderStatus(els.status, {
      kind: "error",
      title: "Something went wrong",
      message: err.message,
      actionLabel: "Try again",
      onAction: () => loadPage(page),
    });
  } finally {
    if (token === state.loadToken) setBusy(false);
  }
}

function setBusy(busy) {
  els.grid.setAttribute("aria-busy", String(busy));
  els.others.disabled = busy;
  els.others.classList.toggle("is-loading", busy);
}

function showOthers() {
  loadPage(randomUnvisitedPage());
  els.chips.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---------- Modal ---------- */

let modalToken = 0;

async function openModal(id) {
  const token = ++modalToken;
  state.lastFocus = document.activeElement;
  els.modal.hidden = false;
  document.body.classList.add("no-scroll");
  requestAnimationFrame(() => els.modal.classList.add("is-open"));
  ui.renderModalLoading(els.modalBody);
  els.modal.querySelector(".modal__close").focus();

  try {
    const movie = await api.getMovie(id);
    if (token !== modalToken || els.modal.hidden) return;
    ui.renderModalMovie(els.modalBody, movie, state.servicesByKey);
  } catch (err) {
    if (token !== modalToken || els.modal.hidden) return;
    ui.renderModalError(els.modalBody, err.message, () => openModal(id));
  }
}

function closeModal() {
  if (els.modal.hidden) return;
  modalToken++;
  els.modal.classList.remove("is-open");
  document.body.classList.remove("no-scroll");
  setTimeout(() => {
    els.modal.hidden = true;
    els.modalBody.replaceChildren(); // stops a playing trailer
  }, 200);
  if (state.lastFocus && document.contains(state.lastFocus)) state.lastFocus.focus();
}

function trapFocus(e) {
  if (e.key !== "Tab" || els.modal.hidden) return;
  const focusable = [...els.modal.querySelectorAll('button, a[href], iframe, [tabindex]:not([tabindex="-1"])')].filter(
    (el) => !el.disabled && el.offsetParent !== null
  );
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

/* ---------- Init ---------- */

function init() {
  els.region.textContent = REGION;
  ui.renderMoods(els.moodGrid, MOODS, pickMood);
  els.back.addEventListener("click", goHome);
  els.home.addEventListener("click", (e) => {
    e.preventDefault();
    goHome();
  });
  els.others.addEventListener("click", showOthers);
  els.modal.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
    trapFocus(e);
  });
  // Warm up the provider list so chips and logos are ready when a mood is picked.
  loadProviders().catch(() => {
    /* surfaced when a mood is picked */
  });
}

init();
