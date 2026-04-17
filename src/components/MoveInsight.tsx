'use client';

import { useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { ChevronRight, Sparkles } from 'lucide-react';
import type { NagType, PlyEval } from '@/lib/accuracy';
import { NAG_META } from '@/lib/accuracy';
import { describeMove, formatEvalPawns } from '@/lib/describeMove';

interface MoveInsightProps {
  moves: string[]; // SAN
  nags: (NagType | null)[];
  evals: (PlyEval | null)[];
  positions: string[]; // FENs; positions[i] is BEFORE move i
  currentMoveIndex: number;
}

/**
 * Chess.com-style per-move review panel. Shows the selected move's
 * classification, eval, natural-language description, and an optional
 * "show follow-up" reveal with the engine's preferred continuation from
 * the position BEFORE the user's move.
 */
export default function MoveInsight({
  moves,
  nags,
  evals,
  positions,
  currentMoveIndex,
}: MoveInsightProps) {
  const [showFollowUp, setShowFollowUp] = useState(false);

  // The description + follow-up are keyed on currentMoveIndex, so when the
  // user clicks a different move we collapse the follow-up.
  useMemo(() => setShowFollowUp(false), [currentMoveIndex]);

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

  const evalText = currEval
    ? formatEvalPawns(currEval.score ?? null, currEval.mate)
    : null;

  // "Show follow-up" resolves the engine's preferred move at the pre-move
  // position (bestUci) into a SAN so we can display it naturally.
  let followUpSan: string | null = null;
  if (bestUci && bestUci !== moveUci) {
    try {
      const g = new Chess(preFen);
      const m = g.move({
        from: bestUci.slice(0, 2),
        to: bestUci.slice(2, 4),
        promotion: bestUci.slice(4, 5) || 'q',
      });
      if (m) followUpSan = m.san;
    } catch {
      // ignore — we'll just not show the follow-up
    }
  }

  const moveNumber = Math.floor(idx / 2) + 1;
  const moveLabel = mover === 'w' ? `${moveNumber}.` : `${moveNumber}…`;

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded p-3 space-y-2">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-[var(--muted)]">
        <Sparkles size={12} className="text-[var(--accent)]" />
        <span>Move insight</span>
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
            <span>is {articleFor(meta.label)} {meta.label.toLowerCase()}</span>
          </span>
        )}
        {evalText && (
          <span
            className="ml-auto font-mono text-xs tabular-nums"
            style={{
              color:
                (currEval?.score ?? 0) > 30
                  ? 'var(--success)'
                  : (currEval?.score ?? 0) < -30
                    ? 'var(--danger)'
                    : 'var(--muted)',
            }}
          >
            {evalText}
          </span>
        )}
      </div>

      <p className="text-[13px] leading-relaxed text-[var(--foreground)]">{description}</p>

      {followUpSan && (nag === 'miss' || nag === 'blunder' || nag === 'mistake' || nag === 'inaccuracy') && (
        <button
          onClick={() => setShowFollowUp((s) => !s)}
          className="flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
        >
          <ChevronRight
            size={12}
            className={`transition-transform ${showFollowUp ? 'rotate-90' : ''}`}
          />
          {showFollowUp ? 'Hide' : 'Show'} follow-up
        </button>
      )}

      {showFollowUp && followUpSan && (
        <div className="text-xs text-[var(--muted)] pl-4 border-l-2 border-[var(--accent)]/40">
          Engine preferred{' '}
          <span className="font-mono font-bold text-[var(--foreground-strong)]">
            {followUpSan}
          </span>{' '}
          in this position.
        </div>
      )}
    </div>
  );
}

function articleFor(word: string): string {
  const first = word[0]?.toLowerCase();
  if (!first) return 'a';
  return 'aeiou'.includes(first) ? 'an' : 'a';
}
