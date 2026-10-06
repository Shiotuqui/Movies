// DOM rendering helpers. All TMDB text is inserted with textContent, never innerHTML.
import { REGION } from "./config.js";

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v === null || v === undefined) continue;
    if (k === "class") el.className = v;
    else if (k === "style") el.style.cssText = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

const svgNS = "http://www.w3.org/2000/svg";
function icon(pathD, cls = "icon") {
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", cls);
  const p = document.createElementNS(svgNS, "path");
  p.setAttribute("d", pathD);
  svg.append(p);
  return svg;
}
const STAR = "M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.5L12 17.3l-5.9 3.2 1.3-6.5-4.9-4.6 6.6-.8z";
const PLAY = "M8 5.5v13l11-6.5z";

/* ---------- Mood buttons ---------- */

export function renderMoods(container, moods, onPick) {
  container.replaceChildren(
    ...moods.map((mood, i) =>
      h(
        "button",
        {
          class: "mood",
          type: "button",
          style: `--mood:${mood.accent};--i:${i}`,
          "data-mood": mood.id,
          onclick: () => onPick(mood),
        },
        h("span", { class: "mood__emoji", "aria-hidden": "true" }, mood.emoji),
        h("span", { class: "mood__label" }, mood.label)
      )
    )
  );
}

/* ---------- Service chips ---------- */

export function renderChips(container, services, selected, onToggle) {
  container.replaceChildren(
    ...services.map((s) =>
      h(
        "button",
        {
          class: "chip",
          type: "button",
          "aria-pressed": String(selected.has(s.key)),
          disabled: !s.available,
          title: s.available ? `Toggle ${s.name}` : `${s.name} isn't available in ${REGION}`,
          onclick: () => onToggle(s.key),
        },
        s.logo ? h("img", { class: "chip__logo", src: s.logo, alt: "", width: 24, height: 24 }) : null,
        h("span", {}, s.name),
        h("span", { class: "chip__check", "aria-hidden": "true" }, "✓")
      )
    )
  );
}

/* ---------- Where to watch ---------- */

export function whereToWatch(keys, servicesByKey, { compact = false } = {}) {
  const items = keys.map((k) => servicesByKey.get(k)).filter(Boolean);
  if (!items.length) return null;
  return h(
    "div",
    { class: `watch${compact ? " watch--compact" : ""}` },
    h("p", { class: "watch__title" }, "Where to watch"),
    h(
      "ul",
      { class: "watch__list" },
      items.map((s) =>
        h(
          "li",
          { class: "watch__item" },
          s.logo ? h("img", { src: s.logo, alt: "", width: 28, height: 28, loading: "lazy" }) : null,
          h("span", {}, s.name)
        )
      )
    )
  );
}

/* ---------- Cards ---------- */

function poster(src, title, cls) {
  if (src) return h("img", { class: cls, src, alt: `Poster for ${title}`, loading: "lazy", width: 342, height: 513 });
  return h("div", { class: `${cls} poster--empty`, role: "img", "aria-label": `No poster for ${title}` }, "🎬");
}

function ratingBadge(rating) {
  return h("span", { class: "badge", title: "TMDB user rating" }, icon(STAR, "icon icon--star"), rating ? rating.toFixed(1) : "–");
}

export function renderCards(container, movies, servicesByKey, onOpen) {
  container.replaceChildren(
    ...movies.map((m, i) =>
      h(
        "article",
        {
          class: "card",
          style: `--i:${i}`,
          tabindex: "0",
          role: "button",
          "aria-label": `${m.title}${m.year ? ` (${m.year})` : ""}. Open details`,
          onclick: () => onOpen(m),
          onkeydown: (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpen(m);
            }
          },
        },
        h("div", { class: "card__media" }, poster(m.poster, m.title, "card__poster"), ratingBadge(m.rating)),
        h(
          "div",
          { class: "card__body" },
          h("h3", { class: "card__title" }, m.title),
          h("p", { class: "card__year" }, m.year || "Year unknown"),
          h("p", { class: "card__overview" }, m.overview || "No overview available."),
          whereToWatch(m.services, servicesByKey, { compact: true })
        )
      )
    )
  );
}

export function renderSkeletons(container, count) {
  container.replaceChildren(
    ...Array.from({ length: count }, (_, i) =>
      h(
        "div",
        { class: "card card--skeleton", style: `--i:${i}`, "aria-hidden": "true" },
        h("div", { class: "card__media shimmer" }),
        h(
          "div",
          { class: "card__body" },
          h("div", { class: "line shimmer", style: "width:70%" }),
          h("div", { class: "line shimmer", style: "width:30%" }),
          h("div", { class: "line shimmer" }),
          h("div", { class: "line shimmer", style: "width:85%" })
        )
      )
    )
  );
}

/* ---------- Status (error / empty) ---------- */

export function renderStatus(container, { kind, title, message, actionLabel, onAction }) {
  if (!kind) {
    container.replaceChildren();
    return;
  }
  container.replaceChildren(
    h(
      "div",
      { class: `status status--${kind}`, role: kind === "error" ? "alert" : "status" },
      h("div", { class: "status__icon", "aria-hidden": "true" }, kind === "error" ? "🎞️" : "🍿"),
      h("h3", { class: "status__title" }, title),
      h("p", { class: "status__message" }, message),
      actionLabel ? h("button", { class: "btn btn--ghost", type: "button", onclick: onAction }, actionLabel) : null
    )
  );
}

/* ---------- Modal content ---------- */

function formatRuntime(min) {
  if (!min) return null;
  const hrs = Math.floor(min / 60);
  const mins = min % 60;
  return hrs ? `${hrs}h ${mins}m` : `${mins}m`;
}

export function renderModalLoading(container) {
  container.replaceChildren(
    h(
      "div",
      { class: "detail detail--loading", "aria-busy": "true" },
      h("div", { class: "detail__hero shimmer" }),
      h(
        "div",
        { class: "detail__content" },
        h("div", { class: "line shimmer", style: "width:60%;height:1.6rem" }),
        h("div", { class: "line shimmer", style: "width:40%" }),
        h("div", { class: "line shimmer" }),
        h("div", { class: "line shimmer" }),
        h("div", { class: "line shimmer", style: "width:75%" })
      ),
      h("p", { class: "visually-hidden", id: "modal-title" }, "Loading movie details")
    )
  );
}

export function renderModalError(container, message, onRetry) {
  container.replaceChildren(
    h(
      "div",
      { class: "detail" },
      h(
        "div",
        { class: "status status--error", role: "alert" },
        h("div", { class: "status__icon", "aria-hidden": "true" }, "🎞️"),
        h("h3", { class: "status__title", id: "modal-title" }, "Couldn't load this movie"),
        h("p", { class: "status__message" }, message),
        h("button", { class: "btn btn--ghost", type: "button", onclick: onRetry }, "Try again")
      )
    )
  );
}

function trailerBlock(trailer, title) {
  if (!trailer) {
    return h("p", { class: "detail__muted" }, "No trailer available for this movie.");
  }
  const thumb = `https://i.ytimg.com/vi/${encodeURIComponent(trailer.key)}/hqdefault.jpg`;
  const wrap = h("div", { class: "trailer" });
  const button = h(
    "button",
    {
      class: "trailer__play",
      type: "button",
      "aria-label": `Play trailer: ${trailer.name || title}`,
      onclick: () => {
        // Load the YouTube player only when asked, to keep the modal fast.
        wrap.replaceChildren(
          h("iframe", {
            src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(trailer.key)}?autoplay=1&rel=0`,
            title: `${title} trailer`,
            allow: "autoplay; encrypted-media; picture-in-picture; fullscreen",
            allowfullscreen: true,
          })
        );
      },
    },
    h("img", { src: thumb, alt: "", loading: "lazy" }),
    h("span", { class: "trailer__icon" }, icon(PLAY))
  );
  wrap.append(button);
  return wrap;
}

export function renderModalMovie(container, movie, servicesByKey) {
  const meta = [movie.year, formatRuntime(movie.runtime)].filter(Boolean);
  const watch = whereToWatch(movie.services, servicesByKey);

  container.replaceChildren(
    h(
      "div",
      { class: "detail" },
      h(
        "div",
        { class: "detail__hero" },
        movie.backdrop ? h("img", { class: "detail__backdrop", src: movie.backdrop, alt: "" }) : null,
        h("div", { class: "detail__hero-fade" })
      ),
      h(
        "div",
        { class: "detail__content" },
        h(
          "div",
          { class: "detail__head" },
          poster(movie.poster, movie.title, "detail__poster"),
          h(
            "div",
            { class: "detail__heading" },
            h("h2", { class: "detail__title", id: "modal-title" }, movie.title),
            movie.tagline ? h("p", { class: "detail__tagline" }, movie.tagline) : null,
            h(
              "p",
              { class: "detail__meta" },
              meta.join(" · "),
              meta.length ? " · " : "",
              ratingBadge(movie.rating),
              movie.voteCount ? h("span", { class: "detail__votes" }, ` ${movie.voteCount.toLocaleString("en-US")} votes`) : null
            ),
            movie.genres.length
              ? h("ul", { class: "pills", "aria-label": "Genres" }, movie.genres.map((g) => h("li", { class: "pill" }, g)))
              : null
          )
        ),
        h("h3", { class: "detail__section" }, "Overview"),
        h("p", { class: "detail__overview" }, movie.overview || "No overview available."),
        watch || h("p", { class: "detail__muted" }, `Not currently streaming on Netflix, Paramount+, Disney+ or Prime Video in ${REGION}.`),
        movie.watchLink
          ? h("a", { class: "detail__link", href: movie.watchLink, target: "_blank", rel: "noopener" }, "See all watch options on TMDB ↗")
          : null,
        h("h3", { class: "detail__section" }, "Trailer"),
        trailerBlock(movie.trailer, movie.title)
      )
    )
  );
}
