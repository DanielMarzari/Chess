'use client';

import { Cpu } from 'lucide-react';

export interface EngineLineInfo {
  depth: number;
  score: number; // centipawns from white's perspective
  mate: number | null;
  pv: string; // principal variation (space-separated moves)
}

interface EngineAnalysisProps {
  enabled: boolean;
  onToggle: () => void;
  lines: EngineLineInfo[];
  depth: number;
  isThinking: boolean;
}

function formatScore(line: EngineLineInfo): string {
  if (line.mate !== null) {
    return `M${line.mate}`;
  }
  const score = line.score / 100;
  return score >= 0 ? `+${score.toFixed(1)}` : score.toFixed(1);
}

function getEvalPercent(lines: EngineLineInfo[]): number {
  if (lines.length === 0) return 50;
  const line = lines[0];
  if (line.mate !== null) {
    return line.mate > 0 ? 100 : 0;
  }
  // Sigmoid-like mapping: +-5 pawns = near 0%/100%
  const score = line.score / 100;
  return Math.round(50 + 50 * (2 / (1 + Math.exp(-0.5 * score)) - 1));
}

export default function EngineAnalysis({ enabled, onToggle, lines, depth, isThinking }: EngineAnalysisProps) {
  const whitePct = getEvalPercent(lines);

  return (
    <div className="bg-[var(--surface)] rounded-lg border border-[var(--border)] overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 border-b border-[var(--border)] flex items-center gap-2 text-sm font-medium hover:bg-[var(--primary)]/20 transition-colors"
      >
        <Cpu size={16} className={enabled ? 'text-[var(--accent)]' : 'text-[var(--muted)]'} />
        <span className={enabled ? 'text-[var(--foreground)]' : 'text-[var(--muted)]'}>
          Engine {enabled ? `(depth ${depth})` : '(off)'}
        </span>
        {isThinking && <span className="ml-auto text-xs text-[var(--accent)] animate-pulse">thinking...</span>}
      </button>

      {enabled && (
        <div className="flex">
          {/* Eval bar */}
          <div className="w-6 min-h-[120px] relative bg-[#1a1a1a]">
            <div
              className="absolute bottom-0 left-0 right-0 bg-[#f0f0f0] transition-all duration-300"
              style={{ height: `${whitePct}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[9px] font-bold mix-blend-difference text-white">
                {lines.length > 0 ? formatScore(lines[0]) : '0.0'}
              </span>
            </div>
          </div>

          {/* Lines */}
          <div className="flex-1 p-2 space-y-1">
            {lines.length === 0 && !isThinking && (
              <p className="text-[var(--muted)] text-xs">No analysis</p>
            )}
            {lines.map((line, i) => (
              <div key={i} className="flex gap-2 text-xs">
                <span className="font-mono font-bold w-12 text-right shrink-0">
                  {formatScore(line)}
                </span>
                <span className="text-[var(--muted)] truncate font-mono">{line.pv}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
