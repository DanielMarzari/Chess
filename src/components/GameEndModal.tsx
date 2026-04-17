'use client';

import { Award, Flag, Handshake, X } from 'lucide-react';
import type { NagType } from '@/lib/accuracy';
import { NAG_META } from '@/lib/accuracy';

export type GameResult =
  | { type: 'checkmate'; winner: 'w' | 'b' }
  | { type: 'resign'; winner: 'w' | 'b' }
  | { type: 'timeout'; winner: 'w' | 'b' }
  | { type: 'stalemate' }
  | { type: 'draw'; reason: string };

interface GameEndModalProps {
  result: GameResult | null;
  humanColor: 'w' | 'b' | null;
  whiteAccuracy: number | null;
  blackAccuracy: number | null;
  nags: (NagType | null)[];
  onClose: () => void;
  onNewGame: () => void;
  onAnalyze: () => void;
}

function countNagsByColor(nags: (NagType | null)[]): {
  w: Record<string, number>;
  b: Record<string, number>;
} {
  const w: Record<string, number> = {};
  const b: Record<string, number> = {};
  nags.forEach((n, i) => {
    if (!n) return;
    const target = i % 2 === 0 ? w : b;
    target[n] = (target[n] || 0) + 1;
  });
  return { w, b };
}

export default function GameEndModal({
  result,
  humanColor,
  whiteAccuracy,
  blackAccuracy,
  nags,
  onClose,
  onNewGame,
  onAnalyze,
}: GameEndModalProps) {
  if (!result) return null;

  const title = getTitle(result, humanColor);
  const subtitle = getSubtitle(result);
  const Icon =
    result.type === 'stalemate' || result.type === 'draw'
      ? Handshake
      : result.type === 'resign'
      ? Flag
      : Award;

  const youWon = humanColor && 'winner' in result && result.winner === humanColor;
  const youLost = humanColor && 'winner' in result && result.winner !== humanColor;
  const titleColor = youWon
    ? 'text-[var(--accent)]'
    : youLost
    ? 'text-[var(--danger)]'
    : 'text-[var(--foreground-strong)]';

  const { w: whiteNags, b: blackNags } = countNagsByColor(nags);

  // Learning-oriented row layout: positive moves first so the user sees
  // what went well before what to work on.
  const nagRows: { type: NagType; label: string }[] = [
    { type: 'brilliant', label: 'Brilliant' },
    { type: 'great', label: 'Great' },
    { type: 'best', label: 'Best' },
    { type: 'good', label: 'Good' },
    { type: 'inaccuracy', label: 'Slips' },
    { type: 'miss', label: 'Missed wins' },
    { type: 'mistake', label: 'Worth a look' },
    { type: 'blunder', label: 'Teaching moments' },
  ];

  // One-line positive framing based on the human's stats. Always biased
  // toward encouragement: highlight strong moves first and frame misses
  // as learning opportunities.
  const youNags = humanColor === 'w' ? whiteNags : humanColor === 'b' ? blackNags : null;
  let encouragement: string | null = null;
  if (youNags) {
    const strong =
      (youNags.brilliant || 0) + (youNags.great || 0) + (youNags.best || 0);
    const misses = (youNags.blunder || 0) + (youNags.mistake || 0);
    if (youNags.brilliant) {
      encouragement = `You found ${youNags.brilliant} brilliant move${
        youNags.brilliant === 1 ? '' : 's'
      } — that takes real insight.`;
    } else if (strong >= 5) {
      encouragement = `${strong} strong moves this game — your calculation is sharpening.`;
    } else if (strong > 0 && misses === 0) {
      encouragement = `Clean game — ${strong} strong move${strong === 1 ? '' : 's'} and no major slips.`;
    } else if (misses > 0) {
      encouragement = `Every teaching moment is a step forward. Review them below and try again.`;
    } else if (strong > 0) {
      encouragement = `Solid work — you found ${strong} strong move${strong === 1 ? '' : 's'} today.`;
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--surface)] border border-[var(--border)] rounded-xl max-w-sm w-full overflow-hidden shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-[var(--muted)] hover:text-[var(--foreground-strong)] p-1"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="p-6 text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[var(--surface-2)]">
            <Icon size={28} className={titleColor} />
          </div>
          <h2 className={`text-2xl font-bold ${titleColor}`}>{title}</h2>
          <p className="text-sm text-[var(--muted)]">{subtitle}</p>
          {encouragement && (
            <p className="text-xs text-[var(--accent)] pt-1">{encouragement}</p>
          )}
        </div>

        {(whiteAccuracy !== null || blackAccuracy !== null) && (
          <div className="px-6 pb-4 grid grid-cols-2 gap-2 text-center">
            <div className="bg-[var(--surface-2)] rounded p-3">
              <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">White</div>
              <div className="font-mono text-lg font-bold text-[var(--foreground-strong)]">
                {whiteAccuracy !== null ? `${whiteAccuracy.toFixed(1)}%` : '—'}
              </div>
              <div className="text-[10px] text-[var(--muted)]">accuracy</div>
            </div>
            <div className="bg-[var(--surface-2)] rounded p-3">
              <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Black</div>
              <div className="font-mono text-lg font-bold text-[var(--foreground-strong)]">
                {blackAccuracy !== null ? `${blackAccuracy.toFixed(1)}%` : '—'}
              </div>
              <div className="text-[10px] text-[var(--muted)]">accuracy</div>
            </div>
          </div>
        )}

        {/* NAG summary */}
        {nags.length > 0 && (
          <div className="px-6 pb-4">
            <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-2 text-center">
              Move quality
            </div>
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1 text-xs">
              <span />
              <span className="text-[var(--muted)] text-center">W</span>
              <span className="text-[var(--muted)] text-center">B</span>
              {nagRows.map((row) => (
                <div key={row.type} className="contents">
                  <span className="flex items-center gap-1">
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ background: NAG_META[row.type].color }}
                    />
                    <span className="text-[var(--foreground)]">{row.label}</span>
                  </span>
                  <span
                    className="text-center font-mono"
                    style={{
                      color: whiteNags[row.type] ? NAG_META[row.type].color : 'var(--muted)',
                    }}
                  >
                    {whiteNags[row.type] || 0}
                  </span>
                  <span
                    className="text-center font-mono"
                    style={{
                      color: blackNags[row.type] ? NAG_META[row.type].color : 'var(--muted)',
                    }}
                  >
                    {blackNags[row.type] || 0}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-[var(--border)] p-3 flex gap-2">
          <button
            onClick={onAnalyze}
            className="flex-1 py-2 rounded text-sm bg-[var(--surface-2)] text-[var(--foreground)] hover:bg-[var(--border)] transition-colors"
          >
            Review
          </button>
          <button
            onClick={onNewGame}
            className="flex-1 py-2 rounded text-sm bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors font-semibold"
          >
            New Game
          </button>
        </div>
      </div>
    </div>
  );
}

function getTitle(result: GameResult, humanColor: 'w' | 'b' | null): string {
  if (result.type === 'draw' || result.type === 'stalemate') return 'Draw';
  if (!('winner' in result)) return 'Draw';
  if (humanColor && result.winner === humanColor) return 'You Won!';
  // Softer framing than "You Lost" — the coach's whole premise is that a
  // loss is a learning opportunity, not a verdict.
  if (humanColor && result.winner !== humanColor) return 'Good game';
  return result.winner === 'w' ? 'White Wins' : 'Black Wins';
}

function getSubtitle(result: GameResult): string {
  switch (result.type) {
    case 'checkmate':
      return `Checkmate — ${result.winner === 'w' ? 'White' : 'Black'} delivered the final blow`;
    case 'resign':
      return `${result.winner === 'w' ? 'Black' : 'White'} resigned`;
    case 'timeout':
      return `${result.winner === 'w' ? 'Black' : 'White'} ran out of time`;
    case 'stalemate':
      return 'Stalemate';
    case 'draw':
      return result.reason;
  }
}
