// Mood → TMDB genre mapping. Edit freely.
//
//   genres   TMDB genre IDs to search for.
//   match    "any" = movie has at least one of the genres (OR),
//            "all" = movie has every genre (AND, fewer results).
//   exclude  Genre IDs to keep out (e.g. no horror when you're happy).
//   accent   Accent color used across the UI while this mood is active.
//
// Full genre list: https://developer.themoviedb.org/reference/genre-movie-list

export const GENRES = {
  ACTION: 28,
  ADVENTURE: 12,
  ANIMATION: 16,
  COMEDY: 35,
  CRIME: 80,
  DOCUMENTARY: 99,
  DRAMA: 18,
  FAMILY: 10751,
  FANTASY: 14,
  HISTORY: 36,
  HORROR: 27,
  MUSIC: 10402,
  MYSTERY: 9648,
  ROMANCE: 10749,
  SCIENCE_FICTION: 878,
  THRILLER: 53,
  WAR: 10752,
  WESTERN: 37,
};

export const GENRE_NAMES = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Sci-Fi",
  53: "Thriller",
  10752: "War",
  37: "Western",
};

const G = GENRES;

export const MOODS = [
  {
    id: "happy",
    label: "Happy",
    emoji: "😄",
    accent: "#ffc93c",
    tagline: "Feel-good picks to keep the smile going.",
    genres: [G.COMEDY, G.FAMILY],
    match: "any",
    exclude: [G.HORROR, G.WAR],
  },
  {
    id: "sad",
    label: "Sad",
    emoji: "😢",
    accent: "#5b9bff",
    tagline: "Stories that understand how you feel.",
    genres: [G.DRAMA],
    match: "any",
    exclude: [G.HORROR],
  },
  {
    id: "excited",
    label: "Excited",
    emoji: "🤩",
    accent: "#ff5a36",
    tagline: "High energy, big thrills, no brakes.",
    genres: [G.ACTION, G.ADVENTURE],
    match: "any",
    exclude: [],
  },
  {
    id: "relaxed",
    label: "Relaxed",
    emoji: "😌",
    accent: "#2ec4b6",
    tagline: "Easygoing movies for a laid-back night.",
    genres: [G.ANIMATION, G.COMEDY],
    match: "any",
    exclude: [G.HORROR, G.THRILLER, G.WAR],
  },
  {
    id: "romantic",
    label: "Romantic",
    emoji: "💘",
    accent: "#ff4d8d",
    tagline: "Love stories worth curling up with.",
    genres: [G.ROMANCE],
    match: "any",
    exclude: [G.HORROR],
  },
  {
    id: "scared",
    label: "Scared",
    emoji: "😱",
    accent: "#d7263d",
    tagline: "Lights off. Don't look behind you.",
    genres: [G.HORROR, G.THRILLER],
    match: "any",
    exclude: [],
  },
  {
    id: "nostalgic",
    label: "Nostalgic",
    emoji: "📼",
    accent: "#e0a458",
    tagline: "A warm trip back in time.",
    genres: [G.FAMILY, G.MUSIC, G.HISTORY],
    match: "any",
    exclude: [G.HORROR],
  },
  {
    id: "thoughtful",
    label: "Thoughtful",
    emoji: "🤔",
    accent: "#9d7bff",
    tagline: "Movies that stay with you after the credits.",
    genres: [G.DRAMA, G.MYSTERY, G.SCIENCE_FICTION],
    match: "any",
    exclude: [],
  },
];

// TMDB syntax: "|" = OR, "," = AND.
export function genreQuery(mood) {
  return mood.genres.join(mood.match === "all" ? "," : "|");
}
