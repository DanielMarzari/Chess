// Lightweight chess-rating logic for Mentor's adaptive opponent.
// We don't run a full Glicko system — just a one-game ELO update that
// nudges the user's estimated rating after each Mentor game finishes.
// The opponent then plays slightly above the user's current rating to
// keep games challenging without being demoralizing.

const STORAGE_KEY = 'userRating';
const DEFAULT_RATING = 1200;
const MIN_RATING = 600;
const MAX_RATING = 3000;
const K_FACTOR = 32; // FIDE K for under-2400 players

export function readUserRating(): number {
  if (typeof window === 'undefined') return DEFAULT_RATING;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_RATING;
    const n = parseInt(raw);
    if (isNaN(n)) return DEFAULT_RATING;
    return Math.max(MIN_RATING, Math.min(MAX_RATING, n));
  } catch {
    return DEFAULT_RATING;
  }
}

export function writeUserRating(rating: number) {
  try {
    const clamped = Math.max(MIN_RATING, Math.min(MAX_RATING, Math.round(rating)));
    localStorage.setItem(STORAGE_KEY, String(clamped));
    window.dispatchEvent(new CustomEvent('settings-changed'));
  } catch {
    // ignore
  }
}

/**
 * Standard ELO update.
 * @param userRating - your current estimated rating
 * @param opponentRating - the rating of the opponent you just played
 * @param actualScore - 1 (win), 0.5 (draw), 0 (loss)
 */
export function updateRating(
  userRating: number,
  opponentRating: number,
  actualScore: 0 | 0.5 | 1
): number {
  const expected = 1 / (1 + Math.pow(10, (opponentRating - userRating) / 400));
  const delta = K_FACTOR * (actualScore - expected);
  return Math.max(MIN_RATING, Math.min(MAX_RATING, userRating + delta));
}

/**
 * Mentor's opponent plays SLIGHTLY BELOW the user's current rating so wins
 * are within reach. The coach still teaches on mistakes, but the game itself
 * should end with the student on top more often than not — the brain reinforces
 * tactical patterns much more strongly when the learning session ends in a
 * successful outcome. Bigger negative offset for beginners where morale is
 * fragile; smaller at higher ratings where the gap per point is larger anyway.
 */
export function mentorOpponentRating(userRating: number): number {
  let offset: number;
  if (userRating < 1000) offset = -150;
  else if (userRating < 1400) offset = -100;
  else if (userRating < 1800) offset = -75;
  else if (userRating < 2200) offset = -50;
  else offset = -25;
  return Math.max(MIN_RATING, Math.min(MAX_RATING, Math.round(userRating + offset)));
}
