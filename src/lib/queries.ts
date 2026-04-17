import { getDb } from './db';
import { initializeDatabase } from './schema';

let initialized = false;

function ensureInit() {
  if (!initialized) {
    initializeDatabase();
    initialized = true;
  }
}

// Games

export interface Game {
  id: number;
  title: string | null;
  white: string | null;
  black: string | null;
  result: string | null;
  pgn: string;
  fen: string | null;
  notes: string | null;
  tags: string | null;
  coaching_moments: number;
  created_at: string;
  updated_at: string;
}

export function getAllGames(): Game[] {
  ensureInit();
  return getDb().prepare('SELECT * FROM games ORDER BY updated_at DESC').all() as Game[];
}

export function getGame(id: number): Game | undefined {
  ensureInit();
  return getDb().prepare('SELECT * FROM games WHERE id = ?').get(id) as Game | undefined;
}

export function createGame(data: {
  title?: string;
  white?: string;
  black?: string;
  result?: string;
  pgn: string;
  fen?: string;
  notes?: string;
  tags?: string;
  coachingMoments?: number;
}): Game {
  ensureInit();
  const stmt = getDb().prepare(`
    INSERT INTO games (title, white, black, result, pgn, fen, notes, tags, coaching_moments)
    VALUES (@title, @white, @black, @result, @pgn, @fen, @notes, @tags, @coaching_moments)
  `);
  const result = stmt.run({
    title: data.title || null,
    white: data.white || null,
    black: data.black || null,
    result: data.result || null,
    pgn: data.pgn,
    fen: data.fen || null,
    notes: data.notes || null,
    tags: data.tags || null,
    coaching_moments: data.coachingMoments ?? 0,
  });
  return getGame(result.lastInsertRowid as number)!;
}

export function updateGame(id: number, data: Partial<Omit<Game, 'id' | 'created_at'>>) {
  ensureInit();
  const fields = Object.keys(data)
    .filter((k) => k !== 'updated_at')
    .map((k) => `${k} = @${k}`)
    .join(', ');
  if (!fields) return;
  getDb()
    .prepare(`UPDATE games SET ${fields}, updated_at = datetime('now') WHERE id = @id`)
    .run({ ...data, id });
}

export function deleteGame(id: number) {
  ensureInit();
  getDb().prepare('DELETE FROM games WHERE id = ?').run(id);
}

// Puzzles

export interface Puzzle {
  id: number;
  fen: string;
  solution: string;
  theme: string | null;
  difficulty: number | null;
  source: string | null;
  created_at: string;
}

export function getRandomPuzzle(): Puzzle | undefined {
  ensureInit();
  return getDb().prepare('SELECT * FROM puzzles ORDER BY RANDOM() LIMIT 1').get() as Puzzle | undefined;
}

export function getPuzzle(id: number): Puzzle | undefined {
  ensureInit();
  return getDb().prepare('SELECT * FROM puzzles WHERE id = ?').get(id) as Puzzle | undefined;
}

export function createPuzzle(data: {
  fen: string;
  solution: string;
  theme?: string;
  difficulty?: number;
  source?: string;
}): Puzzle {
  ensureInit();
  const stmt = getDb().prepare(`
    INSERT INTO puzzles (fen, solution, theme, difficulty, source)
    VALUES (@fen, @solution, @theme, @difficulty, @source)
  `);
  const result = stmt.run({
    fen: data.fen,
    solution: data.solution,
    theme: data.theme || null,
    difficulty: data.difficulty || null,
    source: data.source || null,
  });
  return getPuzzle(result.lastInsertRowid as number)!;
}

export function recordPuzzleAttempt(puzzleId: number, solved: boolean, timeSeconds?: number) {
  ensureInit();
  getDb()
    .prepare('INSERT INTO puzzle_attempts (puzzle_id, solved, time_seconds) VALUES (?, ?, ?)')
    .run(puzzleId, solved ? 1 : 0, timeSeconds || null);
}

export function getPuzzleStats() {
  ensureInit();
  return getDb()
    .prepare(
      `SELECT
        COUNT(*) as total_attempts,
        SUM(solved) as total_solved,
        ROUND(AVG(CASE WHEN solved = 1 THEN time_seconds END), 1) as avg_solve_time
      FROM puzzle_attempts`
    )
    .get() as { total_attempts: number; total_solved: number; avg_solve_time: number | null };
}
