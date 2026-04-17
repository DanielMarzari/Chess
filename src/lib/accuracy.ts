export interface PlyEval {
  score: number; // centipawns from white's perspective
  mate: number | null;
  depth: number;
  // Engine's top move UCI at the position AFTER this ply was played (i.e. the
  // best response to this move). Recorded so the NAG computation for the
  // NEXT ply can answer "was that move the engine's top choice?"
  bestUci?: string;
}

// Convert centipawn eval (white's perspective) to white win percentage
export function cpToWinPercent(cp: number, mate: number | null = null): number {
  if (mate !== null) return mate > 0 ? 100 : 0;
  // Lichess formula
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

// Accuracy for a single move, given the white-win% before and after the move,
// and which color just moved. Returns 0-100.
export function moveAccuracy(
  winPctBefore: number,
  winPctAfter: number,
  mover: 'w' | 'b'
): number {
  // For white, a drop means worse; for black, a rise means worse (since pct is white's)
  const loss = mover === 'w' ? winPctBefore - winPctAfter : winPctAfter - winPctBefore;
  const lossClamped = Math.max(0, loss);
  // Chess.com-style accuracy formula
  const acc = 103.1668 * Math.exp(-0.04354 * lossClamped) - 3.1669;
  return Math.max(0, Math.min(100, acc));
}

// Classify a move by centipawn-loss threshold
export type NagType =
  | 'brilliant'
  | 'great'
  | 'best'
  | 'good'
  | 'book'
  | 'inaccuracy'
  | 'miss' // failed to punish opponent's error — eval was winning, move gives back ground but not a blunder
  | 'mistake'
  | 'blunder';

// Optional context flags for finer classification. isCapture/isCheck/isSacrifice
// let us distinguish "great tactical find" from "play-it-safe best move", and
// "brilliant sacrifice" from "best move that happens to be a recapture".
export interface ClassifyContext {
  isBook?: boolean;
  isBest?: boolean; // exactly matches engine's top choice
  isCapture?: boolean;
  isCheck?: boolean;
  isSacrifice?: boolean; // piece we're moving loses net material on next ply
  // Eval BEFORE the move, from the mover's perspective, in centipawns. Used
  // to distinguish a "miss" (was winning, gave back ground) from a regular
  // mistake (went from rough equality to losing).
  evalBeforeFromMover?: number;
  evalAfterFromMover?: number;
}

export function classifyMove(cpLoss: number, ctx: ClassifyContext = {}): NagType | null {
  if (ctx.isBook) return 'book';
  // "Miss" — you were winning clearly (>= +2 pawns from your perspective),
  // your move gave back significant ground (cpLoss >= 80cp in win-%), but
  // you're still not losing. This is chess.com's "is a miss" flag: a move
  // that fails to capitalize on the opponent's error, distinct from a
  // blunder (which takes you from ok to bad). We check this BEFORE the
  // blunder/mistake thresholds so a winning-but-sloppy move gets flagged
  // correctly.
  if (
    ctx.evalBeforeFromMover !== undefined &&
    ctx.evalAfterFromMover !== undefined &&
    ctx.evalBeforeFromMover >= 200 &&
    cpLoss >= 80 &&
    ctx.evalAfterFromMover > -100
  ) {
    return 'miss';
  }
  // Negative classifications — a blunder is a blunder even if the move
  // happens to capture something.
  if (cpLoss >= 300) return 'blunder';
  if (cpLoss >= 150) return 'mistake';
  if (cpLoss >= 50) return 'inaccuracy';
  // Positive classifications, ordered from strongest-to-weakest. A true
  // brilliant ("!!") requires a sacrifice that still evaluates well, which
  // is hard to stumble into by accident — keep the threshold tight.
  if (ctx.isSacrifice && cpLoss < 15) return 'brilliant';
  if (ctx.isBest && (ctx.isCapture || ctx.isCheck) && cpLoss < 10) return 'great';
  if (cpLoss < 5 || ctx.isBest) return 'best';
  if (cpLoss < 25) return 'good';
  return null;
}

export const NAG_META: Record<NagType, { label: string; symbol: string; color: string; bg: string }> = {
  brilliant: { label: 'Brilliant', symbol: '!!', color: '#1da198', bg: 'rgba(29,161,152,0.15)' },
  great: { label: 'Great', symbol: '!', color: '#1a9aeb', bg: 'rgba(26,154,235,0.15)' },
  best: { label: 'Best', symbol: '★', color: '#759900', bg: 'rgba(117,153,0,0.15)' },
  good: { label: 'Good', symbol: '✓', color: '#5a8a3a', bg: 'rgba(90,138,58,0.08)' },
  book: { label: 'Book', symbol: '📖', color: '#a88a64', bg: 'rgba(168,138,100,0.15)' },
  miss: { label: 'Miss', symbol: '⚠', color: '#c26a00', bg: 'rgba(194,106,0,0.15)' },
  inaccuracy: { label: 'Inaccuracy', symbol: '?!', color: '#e8a300', bg: 'rgba(232,163,0,0.15)' },
  mistake: { label: 'Mistake', symbol: '?', color: '#e68f00', bg: 'rgba(230,143,0,0.15)' },
  blunder: { label: 'Blunder', symbol: '??', color: '#dc322f', bg: 'rgba(220,50,47,0.15)' },
};
