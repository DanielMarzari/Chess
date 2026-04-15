'use client';

import { cpToWinPercent } from '@/lib/accuracy';
import type { NagType } from '@/lib/accuracy';
import { NAG_META } from '@/lib/accuracy';

export interface PlyEval {
  score: number; // centipawns from white's perspective
  mate: number | null;
  depth: number;
}

interface EvalGraphProps {
  evals: (PlyEval | null)[]; // index = ply number, eval AFTER that ply was played
  nags: (NagType | null)[]; // same length as evals
  height: number;
  orientation: 'white' | 'black';
  currentMoveIndex: number; // -1 = starting position
  onJumpTo: (index: number) => void;
  isThinking: boolean;
  currentDepth: number;
  currentScore: number | null; // current position's eval (white-persp)
  currentMate: number | null;
}

const WIDTH = 70;

function clampWinPct(score: number, mate: number | null): number {
  return cpToWinPercent(score, mate);
}

export default function EvalGraph({
  evals,
  nags,
  height,
  orientation,
  currentMoveIndex,
  onJumpTo,
  isThinking,
  currentDepth,
  currentScore,
  currentMate,
}: EvalGraphProps) {
  // Build an ordered list of points [0] = starting position (50%), [1] = after move 0, ...
  const points: { winPct: number; nag: NagType | null; plyIndex: number }[] = [
    { winPct: 50, nag: null, plyIndex: -1 },
  ];
  for (let i = 0; i < evals.length; i++) {
    const e = evals[i];
    const pct = e ? clampWinPct(e.score, e.mate) : points[points.length - 1].winPct;
    points.push({ winPct: pct, nag: nags[i] || null, plyIndex: i });
  }

  // Append current live eval if we're past the last evaluated position
  const showLivePoint =
    currentMoveIndex === evals.length - 1 &&
    currentScore !== null;

  const flipped = orientation === 'black';
  const graphHeight = height - 60; // reserve space for header/footer
  const rowHeight = points.length > 1 ? graphHeight / Math.max(points.length - 1, 1) : 0;

  // Build SVG path
  const pathCoords = points.map((p, i) => {
    const y = i * rowHeight;
    const x = (p.winPct / 100) * WIDTH;
    return { x, y, ...p };
  });

  const areaPath =
    pathCoords.length > 1
      ? `M 0 0 ${pathCoords.map((c) => `L ${c.x} ${c.y}`).join(' ')} L 0 ${pathCoords[pathCoords.length - 1].y} Z`
      : '';

  const linePath =
    pathCoords.length > 1
      ? `M ${pathCoords[0].x} ${pathCoords[0].y} ${pathCoords.slice(1).map((c) => `L ${c.x} ${c.y}`).join(' ')}`
      : '';

  const currentY =
    currentMoveIndex === -1
      ? 0
      : pathCoords.find((c) => c.plyIndex === currentMoveIndex)?.y ?? 0;

  const scoreLabel = formatScore(currentScore, currentMate);

  return (
    <div
      className="flex flex-col bg-[var(--surface)] rounded border border-[var(--border)] overflow-hidden"
      style={{ width: WIDTH + 2, height }}
    >
      {/* Header: current eval */}
      <div className="px-1.5 py-1 border-b border-[var(--border)] flex items-center justify-between">
        <span className="text-[9px] font-mono font-bold text-[var(--foreground-strong)]">
          {scoreLabel}
        </span>
        <span className="text-[8px] font-mono text-[var(--muted)]">
          d{currentDepth || '—'}
        </span>
      </div>

      {/* Graph */}
      <div className="flex-1 relative overflow-hidden" style={{ transform: flipped ? 'scaleY(-1)' : undefined }}>
        <svg
          width={WIDTH}
          height={graphHeight}
          viewBox={`0 0 ${WIDTH} ${graphHeight}`}
          className="absolute inset-0"
          preserveAspectRatio="none"
        >
          {/* Gridlines / backdrop */}
          <defs>
            <linearGradient id="whiteFill" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#262421" />
              <stop offset="100%" stopColor="#eeeeee" />
            </linearGradient>
          </defs>
          {/* Background split */}
          <rect x="0" y="0" width={WIDTH} height={graphHeight} fill="#262421" />
          {/* Area under curve = white share */}
          {pathCoords.length > 1 && (
            <>
              <path d={areaPath} fill="#eeeeee" opacity="0.85" />
              <path d={linePath} fill="none" stroke="#aaaaaa" strokeWidth="1" />
            </>
          )}

          {/* Center vertical line at 50% */}
          <line x1={WIDTH / 2} y1="0" x2={WIDTH / 2} y2={graphHeight} stroke="#888" strokeDasharray="2 2" strokeWidth="0.5" opacity="0.4" />

          {/* NAG markers */}
          {pathCoords.map((c, i) =>
            c.nag && ['blunder', 'mistake', 'inaccuracy'].includes(c.nag) ? (
              <circle
                key={i}
                cx={c.x}
                cy={c.y}
                r="3"
                fill={NAG_META[c.nag].color}
                stroke="#000"
                strokeWidth="0.5"
              />
            ) : null
          )}

          {/* Current position marker */}
          <line
            x1="0"
            y1={currentY}
            x2={WIDTH}
            y2={currentY}
            stroke="#759900"
            strokeWidth="1.5"
            opacity="0.9"
          />
        </svg>

        {/* Click-to-jump overlay */}
        <div className="absolute inset-0 flex flex-col" style={{ transform: flipped ? 'scaleY(-1)' : undefined }}>
          <div
            className="cursor-pointer hover:bg-white/5 transition-colors"
            onClick={() => onJumpTo(-1)}
            title="Starting position"
            style={{ height: rowHeight / 2 }}
          />
          {points.slice(1).map((p, i) => (
            <div
              key={i}
              onClick={() => onJumpTo(p.plyIndex)}
              className="cursor-pointer hover:bg-white/5 transition-colors"
              style={{ height: rowHeight }}
              title={`Move ${Math.floor(p.plyIndex / 2) + 1}${p.plyIndex % 2 === 0 ? '.' : '...'}${p.nag ? ` (${NAG_META[p.nag].label})` : ''}`}
            />
          ))}
        </div>
      </div>

      {/* Footer: thinking indicator */}
      <div className="h-4 border-t border-[var(--border)] flex items-center justify-center bg-[var(--background)]/40">
        {isThinking ? (
          <div className="w-1 h-1 rounded-full bg-[var(--accent)] animate-pulse" />
        ) : null}
        {showLivePoint && (
          <span className="text-[8px] font-mono text-[var(--muted)] ml-1">live</span>
        )}
      </div>
    </div>
  );
}

function formatScore(cp: number | null, mate: number | null): string {
  if (cp === null) return '—';
  if (mate !== null) return mate >= 0 ? `M${mate}` : `-M${Math.abs(mate)}`;
  const score = cp / 100;
  return score >= 0 ? `+${score.toFixed(1)}` : score.toFixed(1);
}
