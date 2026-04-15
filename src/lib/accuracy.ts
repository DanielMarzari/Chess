export interface PlyEval {
  score: number; // centipawns from white's perspective
  mate: number | null;
  depth: number;
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
export type NagType = 'brilliant' | 'great' | 'best' | 'good' | 'book' | 'inaccuracy' | 'mistake' | 'blunder';

export function classifyMove(cpLoss: number, isBook = false): NagType | null {
  if (isBook) return 'book';
  if (cpLoss >= 300) return 'blunder';
  if (cpLoss >= 150) return 'mistake';
  if (cpLoss >= 50) return 'inaccuracy';
  return null;
}

export const NAG_META: Record<NagType, { label: string; symbol: string; color: string; bg: string }> = {
  brilliant: { label: 'Brilliant', symbol: '!!', color: '#1da198', bg: 'rgba(29,161,152,0.15)' },
  great: { label: 'Great', symbol: '!', color: '#1a9aeb', bg: 'rgba(26,154,235,0.15)' },
  best: { label: 'Best', symbol: '★', color: '#759900', bg: 'rgba(117,153,0,0.15)' },
  good: { label: 'Good', symbol: '', color: '#8f8d89', bg: 'transparent' },
  book: { label: 'Book', symbol: '📖', color: '#a88a64', bg: 'rgba(168,138,100,0.15)' },
  inaccuracy: { label: 'Inaccuracy', symbol: '?!', color: '#e8a300', bg: 'rgba(232,163,0,0.15)' },
  mistake: { label: 'Mistake', symbol: '?', color: '#e68f00', bg: 'rgba(230,143,0,0.15)' },
  blunder: { label: 'Blunder', symbol: '??', color: '#dc322f', bg: 'rgba(220,50,47,0.15)' },
};
