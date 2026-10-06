# 🎬 Mood Reel

**Movies for how you feel, streaming on the services you already pay for.**

Mood Reel asks one question, *"How are you feeling today?"*, and recommends six movies that match your mood. It only picks movies included with a **Netflix, Paramount+, Disney+ or Prime Video** subscription (no rentals or purchases).

- 8 moods: happy, sad, excited, relaxed, romantic, scared, nostalgic, thoughtful
- Each mood maps to TMDB genres and has its own accent color
- **Show me others** loads a random page of results, so picks don't repeat
- Service chips let you choose the subscriptions you have (all four on by default)
- A "Where to watch" section with logos on every card and in the details modal
- A details modal with the full overview, runtime, genres and the YouTube trailer
- Movies with too few votes are filtered out
- Plain HTML, CSS and JavaScript. No framework and no build step.
- The TMDB API key stays on the server in a Netlify Function

---

## Project structure

```
.
├── public/                    # Static site (the only folder Netlify publishes)
│   ├── index.html
│   ├── css/styles.css         # Dark cinema theme, mobile-first, animations
│   └── js/
│       ├── config.js          # REGION, MIN_VOTES, results per page…
│       ├── moods.js           # Mood → genre mapping (edit me!)
│       ├── api.js             # Calls /api/* (the Netlify Function)
│       ├── ui.js              # Rendering: cards, chips, modal, states
│       └── app.js             # App state and events
├── netlify/functions/tmdb.js  # Server-side TMDB proxy (reads TMDB_API_KEY)
├── netlify.toml               # Publish dir, functions dir, /api/* redirect
├── .env.example               # Template for your local .env
└── .gitignore                 # Keeps .env out of git
```

### How the streaming filter works

1. `/api/providers` loads TMDB's `/watch/providers/movie` list for the region and **looks up the provider IDs by name**, so none are hard-coded. Related entries count as the same service. For example, "Netflix" and "Netflix basic with Ads" both count as Netflix. Add-on channels such as "Paramount+ Amazon Channel" are skipped.
2. `/api/discover` calls TMDB `/discover/movie` with:
   - `with_watch_providers=ID|ID|…` (`|` means **OR**: the movie must be on at least one selected service)
   - `watch_region=<REGION>`
   - `with_watch_monetization_types=flatrate` (**subscription only**, no rent or buy)
   - `vote_count.gte=<MIN_VOTES>` (skips movies with few votes)
   - `language=en-US`
3. For each of the six picks, the function checks `/movie/{id}/watch/providers` to confirm availability and to list **every** one of the four services that has the movie.

---

## Run locally

### 1. Prerequisites

- [Node.js](https://nodejs.org/) 18 or newer
- A free TMDB account and API key: sign up at <https://www.themoviedb.org/signup>, then go to **Settings → API** (<https://www.themoviedb.org/settings/api>) and request a key. You can use either the **API Key** (v3) or the **API Read Access Token** (v4).
- Netlify CLI:

  ```bash
  npm install -g netlify-cli
  ```

### 2. Get the code

```bash
git clone https://github.com/<your-user>/<your-repo>.git
cd <your-repo>
```

### 3. Add your API key

```bash
cp .env.example .env
```

Open `.env` and paste your key:

```
TMDB_API_KEY=your_real_key_here
```

`.env` is listed in `.gitignore`, so it won't be committed.

### 4. Start the dev server

```bash
netlify dev
```

Open <http://localhost:8888>. `netlify dev` serves `public/`, runs the function, applies the `/api/*` redirect and loads `.env` automatically.

> Opening `index.html` directly or using a plain static server won't work, because the `/api/*` function wouldn't run. Always use `netlify dev`.

---

## Deploy (GitHub + Netlify)

1. **Push to GitHub.** Commit the project (without `.env`) and push it to a GitHub repository.
2. **Create the site.** In [Netlify](https://app.netlify.com/), click **Add new site → Import an existing project → GitHub**, then pick your repository.
3. **Build settings.** Netlify reads them from `netlify.toml`, so leave the defaults:
   - Build command: *(empty)*
   - Publish directory: `public`
   - Functions directory: `netlify/functions`
4. **Add the API key.** Go to **Site configuration → Environment variables → Add a variable**:
   - Key: `TMDB_API_KEY`
   - Value: your TMDB key
   - Scope: make sure **Functions** is included
5. **Deploy.** Click **Deploy site**. If you added the variable after the first deploy, go to **Deploys → Trigger deploy → Deploy site** so the function picks it up.

Every push to your main branch will redeploy automatically.

---

## Customize

### Change the region

Edit **one constant** in `public/js/config.js`:

```js
export const REGION = "US"; // e.g. "GB", "CA", "BR", "DE"
```

Provider IDs are looked up for that region automatically. If a service isn't available there, its chip is disabled.

### Change mood → genre mapping

Edit `public/js/moods.js`. Each mood looks like this:

```js
{
  id: "happy",
  label: "Happy",
  emoji: "😄",
  accent: "#ffc93c",               // accent color while this mood is active
  tagline: "Feel-good picks to keep the smile going.",
  genres: [G.COMEDY, G.FAMILY],    // TMDB genre IDs
  match: "any",                    // "any" = OR, "all" = AND (fewer results)
  exclude: [G.HORROR, G.WAR],      // genres to keep out
}
```

### Other settings (`public/js/config.js`)

| Constant           | Default | What it does                                      |
| ------------------ | ------- | ------------------------------------------------- |
| `REGION`           | `"US"`  | Streaming region (ISO 3166-1 country code)        |
| `MIN_VOTES`        | `150`   | Minimum TMDB vote count to be recommended         |
| `RESULTS_PER_PAGE` | `6`     | Movies shown per mood or "Show me others" click   |

---

## Troubleshooting

| Message / symptom | Fix |
| --- | --- |
| "The server is missing TMDB_API_KEY" | Create `.env` locally, or add the variable in Netlify and redeploy. |
| "TMDB rejected the API key" | Check that the key is correct and has no extra spaces. |
| "Is the Netlify Function running?" | Start the app with `netlify dev`, not a plain static server. |
| "No movies found" | Turn on more services, or lower `MIN_VOTES`. |

---

## Credits

- Movie data and images from [TMDB](https://www.themoviedb.org/). *This product uses the TMDB API but is not endorsed or certified by TMDB.*
- Streaming availability data provided by [JustWatch](https://www.justwatch.com/) via TMDB.
- The footer shows a TMDB wordmark in TMDB's brand colors. You can replace it with an official logo file from TMDB's [logos & attribution page](https://www.themoviedb.org/about/logos-attribution).
