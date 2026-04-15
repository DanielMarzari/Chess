import { Chess } from 'chess.js';

export interface PgnMeta {
  event?: string;
  site?: string;
  date?: string; // YYYY.MM.DD
  white?: string;
  black?: string;
  result?: string; // "1-0" | "0-1" | "1/2-1/2" | "*"
  eco?: string;
  opening?: string;
}

export function todayTag(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

export function computeResult(g: Chess): string {
  if (!g.isGameOver()) return '*';
  if (g.isCheckmate()) return g.turn() === 'w' ? '0-1' : '1-0';
  return '1/2-1/2';
}

export function buildPgn(moves: string[], meta: PgnMeta): string {
  const g = new Chess();
  for (const m of moves) {
    try {
      g.move(m);
    } catch {
      break;
    }
  }
  // Build headers
  const headers: Record<string, string> = {
    Event: meta.event || 'Casual Game',
    Site: meta.site || 'chess.danmarzari.com',
    Date: meta.date || todayTag(),
    Round: '-',
    White: meta.white || 'White',
    Black: meta.black || 'Black',
    Result: meta.result || computeResult(g),
  };
  if (meta.eco) headers.ECO = meta.eco;
  if (meta.opening) headers.Opening = meta.opening;

  // Use chess.js header() if available, else format manually
  try {
    // @ts-expect-error - header exists at runtime on chess.js instance
    g.header(...Object.entries(headers).flat());
    return g.pgn();
  } catch {
    const headerLines = Object.entries(headers)
      .map(([k, v]) => `[${k} "${v}"]`)
      .join('\n');
    return `${headerLines}\n\n${g.pgn()}`;
  }
}
