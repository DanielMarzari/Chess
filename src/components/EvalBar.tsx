'use client';

import { cpToWinPercent } from '@/lib/accuracy';

interface EvalBarProps {
  score: number | null; // centipawns from white's perspective
  mate: number | null;
  depth: number;
  height: number;
  orientation: 'white' | 'black';
  isAnalyzing: boolean;
}

export default function EvalBar({ score, mate, depth, height, orientation, isAnalyzing }: EvalBarProps) {
  const whitePct =
    mate !== null
      ? mate > 0
        ? 100
        : 0
      : score === null
      ? 50
      : cpToWinPercent(score, null);

  const flipped = orientation === 'black';
  const whiteLeading = mate !== null ? mate > 0 : (score ?? 0) >= 0;
  const label = formatScore(score, mate);

  return (
    <div
      className="flex flex-col items-center bg-[var(--surface)] rounded border border-[var(--border)] overflow-hidden"
      style={{ width: 28, height }}
    >
      {/* Bar */}
      <div className="relative flex-1 w-full" style={{ background: flipped ? '#eeeeee' : '#262421' }}>
        <div
          className="absolute left-0 right-0 transition-all duration-300"
          style={{
            background: flipped ? '#262421' : '#eeeeee',
            [flipped ? 'top' : 'bottom']: 0,
            height: `${whitePct}%`,
          }}
        />

        {/* Score label — position depends on who's leading */}
        <div
          className={`absolute left-0 right-0 text-[9px] font-mono font-bold text-center px-0.5 select-none`}
          style={{
            // Place score label on the side of the losing player so it's visible
            [whiteLeading !== flipped ? 'top' : 'bottom']: 2,
            color: whiteLeading !== flipped ? '#dddddd' : '#111',
          }}
        >
          {label}
        </div>

        {/* Mid marker */}
        <div
          className="absolute left-0 right-0 h-px opacity-30"
          style={{ background: '#888', top: '50%' }}
        />

        {/* Depth indicator at bottom */}
        <div
          className="absolute left-0 right-0 text-center text-[8px] font-mono select-none"
          style={{
            bottom: 1,
            color: whiteLeading !== flipped ? '#111' : '#dddddd',
            opacity: 0.55,
          }}
        >
          {depth > 0 && `d${depth}`}
        </div>

        {isAnalyzing && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-1 h-1 rounded-full bg-[var(--accent)] animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );
}

function formatScore(cp: number | null, mate: number | null): string {
  if (cp === null && mate === null) return '0.0';
  if (mate !== null) return mate >= 0 ? `M${mate}` : `-M${Math.abs(mate)}`;
  const score = (cp ?? 0) / 100;
  return score >= 0 ? `+${score.toFixed(1)}` : score.toFixed(1);
}
