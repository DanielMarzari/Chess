'use client';

import type { EngineLineInfo } from './EngineAnalysis';

interface EvalBarProps {
  lines: EngineLineInfo[];
  height: number;
  orientation: 'white' | 'black';
  isThinking: boolean;
  depth: number;
}

function formatScore(line: EngineLineInfo | undefined): string {
  if (!line) return '0.0';
  if (line.mate !== null) return `M${Math.abs(line.mate)}`;
  const score = line.score / 100;
  return score >= 0 ? `+${score.toFixed(1)}` : score.toFixed(1);
}

function getWhitePercent(lines: EngineLineInfo[]): number {
  if (lines.length === 0) return 50;
  const line = lines[0];
  if (line.mate !== null) return line.mate > 0 ? 100 : 0;
  const score = line.score / 100;
  // Clamp using a sigmoid that saturates around +-5 pawns
  return Math.round(50 + 50 * (2 / (1 + Math.exp(-0.45 * score)) - 1));
}

export default function EvalBar({ lines, height, orientation, isThinking, depth }: EvalBarProps) {
  const whitePct = getWhitePercent(lines);
  const primary = lines[0];
  const score = formatScore(primary);
  const whiteLeading = primary ? (primary.mate !== null ? primary.mate > 0 : primary.score >= 0) : true;

  // When board is flipped, invert the bar so white stays at the bottom of white's side
  const flipped = orientation === 'black';

  return (
    <div
      className="flex flex-col items-center bg-[var(--surface)] rounded border border-[var(--border)] overflow-hidden"
      style={{ width: 32, height }}
    >
      {/* Score label (above/below depending on who's winning) */}
      <div
        className={`w-full text-center py-1 text-[10px] font-mono font-bold ${
          (whiteLeading && !flipped) || (!whiteLeading && flipped)
            ? 'text-[var(--muted)] order-last bg-[#262421]'
            : 'text-[var(--foreground-strong)] bg-[#eeeeee] !text-[#111]'
        }`}
      >
        {score}
      </div>

      {/* Vertical bar */}
      <div
        className="relative flex-1 w-full"
        style={{
          background: flipped ? '#eeeeee' : '#262421',
        }}
      >
        <div
          className="absolute left-0 right-0 transition-all duration-300"
          style={{
            background: flipped ? '#262421' : '#eeeeee',
            [flipped ? 'top' : 'bottom']: 0,
            height: `${whitePct}%`,
          }}
        />
        {isThinking && (
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center">
            <div className="inline-block w-1 h-1 rounded-full bg-[var(--accent)] animate-pulse" />
          </div>
        )}
        {depth > 0 && (
          <div className="absolute bottom-1 left-0 right-0 text-center text-[8px] font-mono text-[var(--muted)] mix-blend-difference">
            d{depth}
          </div>
        )}
      </div>
    </div>
  );
}
