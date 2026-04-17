import { Chess } from 'chess.js';
import type { NagType } from './accuracy';

// Generate a short, chess.com-style one-line description of a move.
// Inputs are the positions/metadata around the move; output is ≤ 1 sentence.
//
// This is not a general chess engine — it's a layer of heuristics that tries
// to pick a natural-language framing based on the mover's intent (capture,
// check, castle, central pawn push, development, attack on queen, etc.) and
// the move's classification. It falls back to generic language when no
// specific pattern matches.

export interface DescribeInput {
  preFen: string;
  postFen: string;
  san: string;
  moveUci: string;
  bestUci?: string;
  nag: NagType | null;
  moveIndex: number;
  // Evaluation in centipawns from the MOVER's perspective (positive = the
  // mover is better). Used to distinguish winning/losing/equal narrative.
  cpBeforeFromMover: number | null;
  cpAfterFromMover: number | null;
}

const PIECE_NAME: Record<string, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
};

function isCentralSquare(sq: string): boolean {
  return sq === 'd4' || sq === 'e4' || sq === 'd5' || sq === 'e5';
}

function isDevelopingSquare(piece: string, from: string, to: string, color: 'w' | 'b'): boolean {
  // A knight/bishop leaving its back rank counts as development
  if (piece !== 'n' && piece !== 'b') return false;
  const backRank = color === 'w' ? '1' : '8';
  return from[1] === backRank && to[1] !== backRank;
}

/**
 * Count the number of opponent pieces currently attacked by the moved piece
 * from its new square. Used as a rough "fork" detector.
 */
function countAttackedOpponentPieces(postFen: string, toSquare: string): number {
  try {
    const g = new Chess(postFen);
    // After a move, side-to-move is the OPPONENT of whoever just moved. The
    // piece we just moved is on `toSquare`. We want to count opponent pieces
    // this piece attacks from `toSquare`.
    const board = g.board();
    const file = toSquare.charCodeAt(0) - 97;
    const rank = 8 - parseInt(toSquare[1]);
    const cell = board[rank]?.[file];
    if (!cell) return 0;
    const attackerColor = cell.color;
    // Use chess.js internal: generate all moves for the attacker's color by
    // creating a position "as if" it's their turn. We have to swap turn
    // artificially via FEN manipulation.
    const fenParts = postFen.split(' ');
    fenParts[1] = attackerColor;
    let count = 0;
    try {
      const g2 = new Chess(fenParts.join(' '));
      const moves = g2.moves({ square: toSquare as never, verbose: true });
      for (const m of moves) {
        if (m.captured) count++;
      }
    } catch {
      // ignore
    }
    return count;
  } catch {
    return 0;
  }
}

export function describeMove(args: DescribeInput): string {
  const { san, nag, moveUci, moveIndex } = args;
  const mover: 'w' | 'b' = moveIndex % 2 === 0 ? 'w' : 'b';

  // Parse SAN for basic features
  const isCheck = san.includes('+');
  const isMate = san.includes('#');
  const isCapture = san.includes('x');
  const isCastle = san.startsWith('O-O');
  const isPromotion = san.includes('=');

  if (isMate) return 'Checkmate! The game ends here.';

  if (nag === 'book') {
    if (moveIndex === 0 && isCentralSquare(moveUci.slice(2, 4))) {
      return 'A textbook way to start the game — grab the center.';
    }
    return 'A textbook opening move.';
  }

  // Castling is its own narrative
  if (isCastle) {
    const side = san.startsWith('O-O-O') ? 'queenside' : 'kingside';
    return `Castled ${side} — your king gets tucked away and a rook joins the game.`;
  }

  // Recover piece + from/to/captured from the pre-FEN. We re-play the SAN to
  // get the move object; chess.js is our source of truth on what actually
  // happened.
  let piece = '';
  let captured: string | undefined;
  let fromSq = '';
  let toSq = '';
  try {
    const g = new Chess(args.preFen);
    const m = g.move(san);
    if (m) {
      piece = m.piece;
      captured = m.captured;
      fromSq = m.from;
      toSq = m.to;
    }
  } catch {
    // fall through — we'll just use SAN-based heuristics
  }

  const pieceName = PIECE_NAME[piece] ?? 'piece';
  const capturedName = captured ? PIECE_NAME[captured] : null;

  // Strong-move framing tends to win over neutral framing, so handle positive
  // NAGs first.
  if (nag === 'brilliant') {
    return `A spectacular find — this ${pieceName} sacrifice still comes out ahead.`;
  }
  if (nag === 'great') {
    if (isCheck) return `A sharp tactical blow — ${pieceName} gives check and adds real pressure.`;
    if (isCapture) {
      return `A sharp tactical find — you picked up the ${capturedName ?? 'piece'} while staying ahead.`;
    }
    return `A sharp tactical find — the engine's top choice in a critical spot.`;
  }
  if (nag === 'best') {
    if (isCheck) return `Right call — check, and the pressure stays on.`;
    if (isCapture) {
      if (capturedName === 'pawn') return `Right call — a clean pawn grab.`;
      return `Right call — you take the ${capturedName ?? 'piece'} at the right moment.`;
    }
    if (isDevelopingSquare(piece, fromSq, toSq, mover)) {
      return `The engine's top choice — getting your ${pieceName} out and into the game.`;
    }
    return `The engine's top choice in this position.`;
  }
  if (nag === 'good') {
    if (isCheck) return `A solid move — adds pressure without committing too much.`;
    if (isCapture) {
      return `A solid move — you take the ${capturedName ?? 'piece'}, keeping the balance.`;
    }
    if (isDevelopingSquare(piece, fromSq, toSq, mover)) {
      return `A solid move — mobilizing your ${pieceName}.`;
    }
    return `A solid choice — not quite the top move, but close.`;
  }

  if (nag === 'miss') {
    return `A missed chance — you were winning, and this gives back some ground.`;
  }
  if (nag === 'inaccuracy') {
    return `A small slip — the position worsens slightly.`;
  }
  if (nag === 'mistake') {
    return `Worth a second look — there's a clearer path here.`;
  }
  if (nag === 'blunder') {
    if (isCapture) {
      return `This capture backfires — the opponent has a stronger follow-up.`;
    }
    return `A real teaching moment — the evaluation swings hard. Let's study the alternatives.`;
  }

  // Neutral fallback — describe the move mechanically. Use the extra
  // signals we have to be a bit more specific than "a quiet move".
  if (isCheck) return `${pieceName.charAt(0).toUpperCase() + pieceName.slice(1)} check.`;
  if (isCapture) {
    if (capturedName) return `You take the ${capturedName}.`;
    return 'A capture.';
  }
  if (isPromotion) return 'Pawn promotes.';
  if (piece === 'p' && toSq && isCentralSquare(toSq)) {
    return 'A central pawn push — claiming space in the middle.';
  }
  if (piece && isDevelopingSquare(piece, fromSq, toSq, mover)) {
    return `You mobilize your ${pieceName}.`;
  }
  // Rough fork detection — if this move is a knight and it attacks ≥ 2
  // opponent pieces from its new square, call it out.
  if (piece === 'n' && countAttackedOpponentPieces(args.postFen, toSq) >= 2) {
    return `A knight attack — pressuring multiple pieces at once.`;
  }

  return 'A quiet move.';
}

/**
 * Convenience: format a centipawn score (white perspective) as "+1.23" or
 * "-0.50", as chess.com does per move.
 */
export function formatEvalPawns(cp: number | null, mate: number | null | undefined): string {
  if (mate !== null && mate !== undefined) {
    return mate > 0 ? `M${mate}` : `-M${Math.abs(mate)}`;
  }
  if (cp === null) return '—';
  const pawns = cp / 100;
  const sign = pawns > 0 ? '+' : pawns < 0 ? '' : '±';
  return `${sign}${pawns.toFixed(2)}`;
}
