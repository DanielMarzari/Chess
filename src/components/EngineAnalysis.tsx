'use client';

import { Cpu } from 'lucide-react';

export interface EngineLineInfo {
  depth: number;
  score: number;
  mate: number | null;
  pv: string;
}

interface EngineAnalysisProps {
  lines: EngineLineInfo[];
  depth: number;
  isThinking: boolean;
}

function formatScore(line: EngineLineInfo): string {
  // Lines are already normalized to white's perspective
  if (line.mate !== null) {
    return line.mate >= 0 ? `M${line.mate}` : `-M${Math.abs(line.mate)}`;
  }
  const score = line.score / 100;
  return score >= 0 ? `+${score.toFixed(2)}` : score.toFixed(2);
}

export default function EngineAnalysis({ lines, depth, isThinking }: EngineAnalysisProps) {
  return (
    <div className="bg-[var(--surface)] rounded border border-[var(--border)] overflow-hidden">
      <div className="px-3 py-2 border-b border-[var(--border)] flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-[var(--muted)]">
        <Cpu size={14} className="text-[var(--accent)]" />
        <span>Analysis {depth > 0 && `· d${depth}`}</span>
        {isThinking && (
          <span className="ml-auto text-[10px] normal-case text-[var(--accent)] animate-pulse">
            thinking…
          </span>
        )}
      </div>

      <div className="p-2 space-y-1 min-w-0">
        {lines.length === 0 && (
          <p className="text-[var(--muted)] text-xs">Waiting for engine…</p>
        )}
        {lines.map((line, i) => (
          <div key={i} className="flex gap-2 text-xs font-mono">
            <span className="font-bold w-12 text-right shrink-0 text-[var(--foreground-strong)]">
              {formatScore(line)}
            </span>
            <span className="text-[var(--muted)] truncate">{line.pv}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
