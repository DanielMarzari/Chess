import { Chess, type Square, type PieceSymbol, type Color } from 'chess.js';
import type { NagType } from './accuracy';

const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

const PIECE_NAMES: Record<PieceSymbol, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
};

function pieceName(p: PieceSymbol): string {
  return PIECE_NAMES[p] || 'piece';
}

/**
 * Exchange-aware capture check.
 * Given a position `fen` where the side-to-move is about to play `uci` (a capture),
 * returns true if that capture wins material after considering one level of recapture.
 * Handles the "defended pawn" case: Nxe5 when e5 is defended by a pawn is NOT winning.
 */
export function isWinningCapture(fen: string, uci: string): boolean {
  if (uci.length < 4) return false;
  const g = new Chess(fen);
  const from = uci.slice(0, 2) as Square;
  const to = uci.slice(2, 4) as Square;
  const attacker = g.get(from);
  const target = g.get(to);
  if (!attacker || !target) return false;

  const attackerValue = PIECE_VALUES[attacker.type];
  const targetValue = PIECE_VALUES[target.type];

  // Apply the capture
  try {
    g.move({ from, to, promotion: uci.slice(4, 5) || 'q' });
  } catch {
    return false;
  }

  // Defender-to-move now: any legal move that recaptures on `to`?
  const defenderMoves = g.moves({ verbose: true }) as Array<{
    to: string;
    piece?: PieceSymbol;
    flags?: string;
  }>;
  const recaps = defenderMoves.filter(
    (m) => m.to === to && (m.flags?.includes('c') || m.flags?.includes('e'))
  );
  if (recaps.length === 0) {
    // No legal recapture — free capture (attacker just gains target material)
    return true;
  }

  // There IS a recapture. Attacker's net = target - attacker (they lose their piece on recap).
  // Winning only if net > 0, i.e. target is strictly more valuable than attacker.
  return targetValue > attackerValue;
}

function materialCount(g: Chess, color: Color): number {
  const board = g.board();
  let total = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell && cell.color === color) total += PIECE_VALUES[cell.type];
    }
  }
  return total;
}

// Total material for the side to move's opponent after a PV is played out
function materialAfterLine(startFen: string, pv: string[], color: Color): number {
  const g = new Chess(startFen);
  for (const uci of pv) {
    if (uci.length < 4) break;
    try {
      g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4, 5) || 'q' });
    } catch {
      break;
    }
  }
  return materialCount(g, color);
}

// Find first WINNING capture in a PV (defender-aware — skips even trades and
// losing captures like Nxb5 when b5 is defended by a rook).
function firstCapture(
  startFen: string,
  pv: string[]
): { attackerType: PieceSymbol; capturedType: PieceSymbol; toSquare: string; ply: number } | null {
  const g = new Chess(startFen);
  let ply = 0;
  let currentFen = startFen;
  for (const uci of pv) {
    if (uci.length < 4) break;
    const from = uci.slice(0, 2) as Square;
    const to = uci.slice(2, 4) as Square;
    const promotion = uci.slice(4, 5) || 'q';
    const target = g.get(to);
    const attacker = g.get(from);
    try {
      const move = g.move({ from, to, promotion });
      ply++;
      if (move && target && attacker && isWinningCapture(currentFen, uci)) {
        return { attackerType: attacker.type, capturedType: target.type, toSquare: to, ply };
      }
      // En passant treated as pawn-takes-pawn, also defender-aware
      if (
        move &&
        move.flags.includes('e') &&
        attacker &&
        isWinningCapture(currentFen, uci)
      ) {
        return { attackerType: attacker.type, capturedType: 'p', toSquare: to, ply };
      }
      currentFen = g.fen();
    } catch {
      break;
    }
  }
  return null;
}

// Does a SAN move give check or checkmate?
function isCheck(san: string): boolean {
  return san.includes('+') || san.includes('#');
}
function isMate(san: string): boolean {
  return san.includes('#');
}

// Count mate-in-N from a PV of SAN moves (looks for '#')
function mateDistanceFromPv(pv: string[]): number | null {
  for (let i = 0; i < pv.length; i++) {
    if (pv[i].includes('#')) return Math.floor(i / 2) + 1;
  }
  return null;
}

// Convert UCI PV to SAN using chess.js, starting from fen
function uciPvToSan(fen: string, pv: string[], limit = 6): string[] {
  const g = new Chess(fen);
  const san: string[] = [];
  for (let i = 0; i < Math.min(pv.length, limit); i++) {
    const uci = pv[i];
    if (uci.length < 4) break;
    try {
      const m = g.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.slice(4, 5) || 'q',
      });
      if (m) san.push(m.san);
      else break;
    } catch {
      break;
    }
  }
  return san;
}

export interface CoachExplanation {
  severity: NagType;
  whyBad: string;
  whyBest: string;
  hintBestMove?: string; // SAN of best move (for "give up" reveal)
  threatenedSquares: string[]; // squares affected by the best move's plan
}

export interface ExplainInput {
  preMoveFen: string; // position BEFORE the bad move (side to move = the mover who blundered)
  badMoveSan: string;
  badMoveUci: string; // e.g. "e2e4"
  bestMoveSan: string;
  bestMoveUci: string;
  bestPvUci: string[]; // engine's principal variation (UCI), INCLUDING the best move
  responsePvUci: string[]; // engine's PV from position AFTER user's bad move (opponent's best response + follow-ups)
  evalBeforeCp: number; // white's perspective, centipawns
  evalAfterBadCp: number; // white's perspective, centipawns
  mover: Color; // color who made the bad move
  nag: NagType;
}

/**
 * Build a human-friendly explanation of why a move was bad and why another is best.
 * Purely heuristic — no LLM. Designed to be swappable later with a richer generator.
 */
export function explainMove(input: ExplainInput): CoachExplanation {
  const {
    preMoveFen,
    badMoveSan,
    bestMoveSan,
    bestMoveUci,
    bestPvUci,
    responsePvUci,
    evalBeforeCp,
    evalAfterBadCp,
    mover,
    nag,
  } = input;

  const moverName = mover === 'w' ? 'White' : 'Black';
  const oppColor: Color = mover === 'w' ? 'b' : 'w';
  const oppName = mover === 'w' ? 'Black' : 'White';

  // --- Why the bad move was bad --------------------------------------------
  let whyBad = '';

  // Eval drop (in the MOVER's perspective)
  const moverSign = mover === 'w' ? 1 : -1;
  const dropCp = (evalBeforeCp - evalAfterBadCp) * moverSign;
  const dropPawns = (dropCp / 100).toFixed(1);

  // Was the best continuation a mate that was missed?
  const bestSanPv = uciPvToSan(preMoveFen, bestPvUci, 6);
  const missedMate = mateDistanceFromPv(bestSanPv);

  // Does the opponent's best response after our bad move capture a piece of ours?
  const postBadFen = (() => {
    const g = new Chess(preMoveFen);
    try {
      g.move({
        from: input.badMoveUci.slice(0, 2),
        to: input.badMoveUci.slice(2, 4),
        promotion: input.badMoveUci.slice(4, 5) || 'q',
      });
    } catch {
      return preMoveFen;
    }
    return g.fen();
  })();

  const oppCapture = firstCapture(postBadFen, responsePvUci);

  // Is the opponent's response a mating sequence?
  const responseSan = uciPvToSan(postBadFen, responsePvUci, 6);
  const deliversMate = mateDistanceFromPv(responseSan);

  // Build the "why bad" sentence
  if (deliversMate !== null) {
    whyBad = `After ${badMoveSan}, ${oppName} can force mate in ${deliversMate}.`;
  } else if (missedMate !== null) {
    whyBad = `${badMoveSan} missed a forced mate in ${missedMate}. You had the win on the board.`;
  } else if (oppCapture && oppCapture.ply <= 2) {
    const capturedValue = PIECE_VALUES[oppCapture.capturedType];
    if (capturedValue >= 3) {
      whyBad = `${badMoveSan} left your ${pieceName(oppCapture.capturedType)} on ${oppCapture.toSquare} hanging — ${oppName} simply takes it with their ${pieceName(oppCapture.attackerType)}.`;
    } else {
      whyBad = `${badMoveSan} lets ${oppName} pick off a ${pieceName(oppCapture.capturedType)} on ${oppCapture.toSquare}.`;
    }
  } else if (oppCapture) {
    whyBad = `${badMoveSan} gives ${oppName} a tactical blow a few moves deep — they can win a ${pieceName(oppCapture.capturedType)} on ${oppCapture.toSquare} within ${oppCapture.ply} plies.`;
  } else if (dropCp >= 300) {
    whyBad = `${badMoveSan} hands ${oppName} a large positional or strategic advantage — the evaluation swings by about ${dropPawns} pawns against you.`;
  } else {
    whyBad = `${badMoveSan} is inaccurate — the position worsens by about ${dropPawns} pawns for ${moverName}.`;
  }

  // --- Why the best move is best -------------------------------------------
  let whyBest = '';

  if (isMate(bestMoveSan)) {
    whyBest = `${bestMoveSan} is checkmate.`;
  } else if (missedMate !== null) {
    whyBest = `${bestMoveSan} starts a forced mate in ${missedMate}.`;
  } else {
    // Detect if best move captures something
    const preGame = new Chess(preMoveFen);
    const captureSquare = bestMoveUci.slice(2, 4) as Square;
    const capturedPiece = preGame.get(captureSquare);
    const movedPiece = preGame.get(bestMoveUci.slice(0, 2) as Square);

    if (capturedPiece) {
      const val = PIECE_VALUES[capturedPiece.type];
      const movedVal = movedPiece ? PIECE_VALUES[movedPiece.type] : 0;
      if (val >= movedVal) {
        whyBest = `${bestMoveSan} wins material — capturing the ${pieceName(capturedPiece.type)} on ${captureSquare}.`;
      } else {
        whyBest = `${bestMoveSan} captures the ${pieceName(capturedPiece.type)} on ${captureSquare} and is supported by follow-up pressure.`;
      }
    } else if (isCheck(bestMoveSan)) {
      whyBest = `${bestMoveSan} gives check and forces ${oppName} into a defensive reply.`;
    } else {
      // Does the best PV lead to a tactic within 3 plies?
      const tactic = firstCapture(preMoveFen, bestPvUci);
      if (tactic && tactic.ply <= 4 && PIECE_VALUES[tactic.capturedType] >= 3) {
        whyBest = `${bestMoveSan} sets up a tactic: after accurate play, you win the ${pieceName(tactic.capturedType)} on ${tactic.toSquare} within a few moves.`;
      } else {
        whyBest = `${bestMoveSan} holds the evaluation and keeps your chances alive.`;
      }
    }
  }

  // Collect the squares the best-move plan touches (for board highlights)
  const threatenedSquares = new Set<string>();
  for (let i = 0; i < Math.min(bestPvUci.length, 4); i++) {
    const uci = bestPvUci[i];
    if (uci.length >= 4) {
      threatenedSquares.add(uci.slice(2, 4));
    }
  }

  return {
    severity: nag,
    whyBad,
    whyBest,
    hintBestMove: bestMoveSan,
    threatenedSquares: Array.from(threatenedSquares),
  };
}

/**
 * Heuristic: find the best-looking response for the side to move at `fen`.
 * Priority: mate-in-1 → winning capture (defender-aware) → check → null.
 * Used by the coach to refute a student's wrong retry attempt without
 * needing a full engine call.
 */
export function findRefutation(fen: string): {
  uci: string;
  san: string;
  type: 'mate' | 'capture' | 'check';
  captured?: PieceSymbol;
} | null {
  const g = new Chess(fen);
  const moves = g.moves({ verbose: true }) as Array<{
    from: string;
    to: string;
    san: string;
    flags: string;
    captured?: PieceSymbol;
    piece: PieceSymbol;
    promotion?: string;
  }>;
  if (moves.length === 0) return null;

  // 1. Mate in 1
  for (const m of moves) {
    if (m.san.includes('#')) {
      return {
        uci: `${m.from}${m.to}${m.promotion || ''}`,
        san: m.san,
        type: 'mate',
      };
    }
  }

  // 2. Best winning capture (defender-aware)
  const captures = moves.filter((m) => m.flags.includes('c') || m.flags.includes('e'));
  let bestCap: (typeof moves)[0] | null = null;
  let bestVal = 0;
  for (const m of captures) {
    const uci = `${m.from}${m.to}${m.promotion || ''}`;
    if (!isWinningCapture(fen, uci)) continue;
    const v = PIECE_VALUES[m.captured || 'p'] || 0;
    if (v > bestVal) {
      bestVal = v;
      bestCap = m;
    }
  }
  if (bestCap) {
    return {
      uci: `${bestCap.from}${bestCap.to}${bestCap.promotion || ''}`,
      san: bestCap.san,
      type: 'capture',
      captured: bestCap.captured,
    };
  }

  // 3. First check
  for (const m of moves) {
    if (m.san.includes('+')) {
      return {
        uci: `${m.from}${m.to}${m.promotion || ''}`,
        san: m.san,
        type: 'check',
      };
    }
  }

  return null;
}

export function severityLabel(nag: NagType): string {
  switch (nag) {
    case 'blunder':
      return 'Blunder';
    case 'mistake':
      return 'Mistake';
    case 'inaccuracy':
      return 'Inaccuracy';
    default:
      return 'Note';
  }
}
