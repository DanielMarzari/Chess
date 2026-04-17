import { getDb } from './db';

export function initializeDatabase() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      white TEXT,
      black TEXT,
      result TEXT,
      pgn TEXT NOT NULL,
      fen TEXT,
      notes TEXT,
      tags TEXT,
      coaching_moments INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS puzzles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fen TEXT NOT NULL,
      solution TEXT NOT NULL,
      theme TEXT,
      difficulty INTEGER,
      source TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS puzzle_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      puzzle_id INTEGER NOT NULL REFERENCES puzzles(id),
      solved INTEGER NOT NULL DEFAULT 0,
      time_seconds INTEGER,
      attempted_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migrations for existing tables that may pre-date later columns.
  const gameCols = db.prepare(`PRAGMA table_info(games)`).all() as Array<{
    name: string;
  }>;
  if (!gameCols.some((c) => c.name === 'coaching_moments')) {
    db.exec(`ALTER TABLE games ADD COLUMN coaching_moments INTEGER DEFAULT 0`);
  }
}
