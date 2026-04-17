'use client';

import { useEffect, useState } from 'react';
import { Chess } from 'chess.js';
import { ChevronLeft, ChevronRight, Sparkles, Star } from 'lucide-react';
import type { NagType, PlyEval } from '@/lib/accuracy';
import { NAG_META } from '@/lib/accuracy';
import { describeMove, formatEvalPawns } from '@/lib/describeMove';

interface MoveInsightProps {
  moves: string[]; // SAN
  nags: (NagType | null)[];
  evals: (PlyEval | null)[];
  positions: string[]; // FENs; positions[i] is BEFORE move i
  currentMoveIndex: number;
  onMoveClick: (index: number) => void;
  // When true (typically once the game has ended), the panel re-labels
  // itself as "Game Review" and surfaces jump-to-next-issue buttons so the
  // user can step through teaching moments the way chess.com does.
  reviewMode?: boolean;
  // If the user picked a side (mentor / PGN import with perspective),
  // reviewColor lets us prioritize THEIR mistakes when stepping issue→issue.
  reviewColor?: 'w' | 'b' | null;
}

const NEGATIVE_NAGS: NagType[] = ['blunder', 'mistake', 'miss', 'inaccuracy'];

/**
 * Chess.com-style per-move review panel. Shows the selected move's
 * classification, eval, natural-language description, and — in review
 * mode — prev/next controls, plus an optional "show best" reveal with
 * the engine's preferred continuation from the position BEFORE the
 * user's move.
 */
export default function MoveInsight({
  moves,
  nags,
  evals,
  positions,
  currentMoveIndex,
  onMoveClick,
  reviewMode = false,
  reviewColor = null,
}: MoveInsightProps) {
  const [showBest, setShowBest] = useState(false);

  // Reset the "show best" reveal whenever the selected move changes so we
  // don't carry a reveal over to a move where it doesn't make sense.
  useEffect(() => {
    setShowBest(false);
  }, [currentMoveIndex]);

  const idx = currentMoveIndex;
  if (idx < 0 || idx >= moves.length) return null;

  const san = moves[idx];
  const nag = nags[idx] ?? null;
  const meta = nag ? NAG_META[nag] : null;
  const preFen = positions[idx];
  const postFen = positions[idx + 1] ?? positions[positions.length - 1];
  const prevEval = idx === 0 ? null : evals[idx - 1];
  const currEval = evals[idx] ?? null;
  const bestUci = prevEval?.bestUci;

  // Reconstruct this move's UCI by replaying through chess.js
  let moveUci = '';
  try {
    const g = new Chess(preFen);
    const m = g.move(san);
    if (m) moveUci = `${m.from}${m.to}${m.promotion || ''}`;
  } catch {
    // leave moveUci empty — describeMove will fall back
  }

  const mover: 'w' | 'b' = idx % 2 === 0 ? 'w' : 'b';
  const cpWhite = currEval?.score ?? null;
  const cpBeforeWhite = prevEval?.score ?? (idx === 0 ? 0 : null);
  const cpFromMover = cpWhite !== null ? (mover === 'w' ? cpWhite : -cpWhite) : null;
  const cpBeforeFromMover =
    cpBeforeWhite !== null ? (mover === 'w' ? cpBeforeWhite : -cpBeforeWhite) : null;

  const description = describeMove({
    preFen,
    postFen,
    san,
    moveUci,
    bestUci,
    nag,
    moveIndex: idx,
    cpBeforeFromMover,
    cpAfterFromMover: cpFromMover,
  });

  const evalText = currEval ? formatEvalPawns(currEval.score ?? null, currEval.mate) : null;

  // Resolve the engine's preferred move at the pre-move position into SAN.
  let bestSan: string | null = null;
  if (bestUci && bestUci !== moveUci) {
    try {
      const g = new Chess(preFen);
      const m = g.move({
        from: bestUci.slice(0, 2),
        to: bestUci.slice(2, 4),
        promotion: bestUci.slice(4, 5) || 'q',
      });
      if (m) bestSan = m.san;
    } catch {
      // ignore
    }
  }

  const moveNumber = Math.floor(idx / 2) + 1;
  const moveLabel = mover === 'w' ? `${moveNumber}.` : `${moveNumber}…`;

  // Jump helpers for review mode. "Issue" = blunder/mistake/miss/inaccuracy,
  // biased toward the user's color when we know it.
  const findNextIssue = (dir: 1 | -1): number | null => {
    for (let i = idx + dir; i >= 0 && i < nags.length; i += dir) {
      const n = nags[i];
      if (!n || !NEGATIVE_NAGS.includes(n)) continue;
      if (reviewColor) {
        const m: 'w' | 'b' = i % 2 === 0 ? 'w' : 'b';
        if (m !== reviewColor) continue;
      }
      return i;
    }
    return null;
  };

  const hasAlternative = !!bestSan;
  const isIssue = nag !== null && NEGATIVE_NAGS.includes(nag);

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-[var(--muted)]">
          <Sparkles size={12} className="text-[var(--accent)]" />
          <span>{reviewMode ? 'Game review' : 'Move insight'}</span>
        </div>
        {reviewMode && (
          <div className="flex items-center gap-1 text-[10px] text-[var(--muted)]">
            <NavButton
              title="Previous teaching moment"
              onClick={() => {
                const i = findNextIssue(-1);
                if (i !== null) onMoveClick(i);
              }}
            >
              <ChevronLeft size={12} />
            </NavButton>
            <NavButton
              title="Next teaching moment"
              onClick={() => {
                const i = findNextIssue(1);
                if (i !== null) onMoveClick(i);
              }}
            >
              <ChevronRight size={12} />
            </NavButton>
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-[var(--muted)] font-mono text-sm">{moveLabel}</span>
        <span className="font-mono font-semibold text-[var(--foreground-strong)]">{san}</span>
        {meta && (
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-1"
            style={{ color: meta.color, background: meta.bg }}
          >
            <span className="font-mono">{meta.symbol}</span>
            <span>
              is {articleFor(meta.label)} {meta.label.toLowerCase()}
            </span>
          </span>
        )}
        {evalText && (
          <span
            className="ml-auto font-mono text-xs tabular-nums"
            style={{
              color:
                Math.abs(currEval?.score ?? 0) > 30
                  ? 'var(--foreground-strong)'
                  : 'var(--muted)',
            }}
            title={
              (currEval?.score ?? 0) > 0
                ? 'White advantage'
                : (currEval?.score ?? 0) < 0
                  ? 'Black advantage'
                  : 'Roughly equal'
            }
          >
            {evalText}
          </span>
        )}
      </div>

      <p className="text-[13px] leading-relaxed text-[var(--foreground)]">{description}</p>

      {/* Best / Next controls mirror chess.com's review buttons. "Best" is
          only meaningful when there IS an alternative worth showing (the
          move wasn't already best/great/brilliant). */}
      <div className="flex items-center gap-1.5 pt-1">
        {hasAlternative && isIssue && (
          <button
            onClick={() => setShowBest((s) => !s)}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-2)] transition-colors"
            title="Reveal the engine's preferred move"
          >
            <Star size={12} className="text-[var(--accent)]" />
            {showBest ? 'Hide best' : 'Show best'}
          </button>
        )}
        {reviewMode && (
          <button
            onClick={() => {
              const nextIdx = Math.min(moves.length - 1, idx + 1);
              onMoveClick(nextIdx);
            }}
            disabled={idx >= moves.length - 1}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-40 ml-auto"
          >
            Next
            <ChevronRight size={12} />
          </button>
        )}
      </div>

      {showBest && bestSan && (
        <div className="text-xs text-[var(--muted)] pl-3 border-l-2 border-[var(--accent)]/60">
          Engine preferred{' '}
          <span className="font-mono font-bold text-[var(--foreground-strong)]">{bestSan}</span> in
          this position.
        </div>
      )}
    </div>
  );
}

function NavButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-1 rounded hover:bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--foreground)]"
    >
      {children}
    </button>
  );
}

function articleFor(word: string): string {
  const first = word[0]?.toLowerCase();
  if (!first) return 'a';
  return 'aeiou'.includes(first) ? 'an' : 'a';
}
