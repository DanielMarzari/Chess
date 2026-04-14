'use client';

import { Cpu } from 'lucide-react';

export interface EngineLineInfo {
  depth: number;
  score: number;
  mate: number | null;
  pv: string;
}

interface EngineAnalysisProps {
  enabled: boolean;
  onToggle: () => void;
  lines: EngineLineInfo[];
  depth: number;
  isThinking: boolean;
}

function formatScore(line: EngineLineInfo): string {
  if (line.mate !== null) return `M${Math.abs(line.mate)}`;
  const score = line.score / 100;
  return score >= 0 ? `+${score.toFixed(1)}` : score.toFixed(1);
}

function getEvalPercent(lines: EngineLineInfo[]): number {
  if (lines.length === 0) return 50;
  const line = lines[0];
  if (line.mate !== null) return line.mate > 0 ? 100 : 0;
  const score = line.score / 100;
  return Math.round(50 + 50 * (2 / (1 + Math.exp(-0.5 * score)) - 1));
}

export default function EngineAnalysis({ enabled, onToggle, lines, depth, isThinking }: EngineAnalysisProps) {
  const whitePct = getEvalPercent(lines);

  return (
    <div className="bg-[var(--surface)] rounded border border-[var(--border)] overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 border-b border-[var(--border)] flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold hover:bg-[var(--surface-2)] transition-colors"
      >
        <Cpu size={14} className={enabled ? 'text-[var(--accent)]' : 'text-[var(--muted)]'} />
        <span className={enabled ? 'text-[var(--foreground-strong)]' : 'text-[var(--muted)]'}>
          Analysis {enabled && `· d${depth}`}
        </span>
        {isThinking && <span className="ml-auto text-[10px] normal-case text-[var(--accent)] animate-pulse">thinking…</span>}
      </button>

      {enabled && (
        <div className="flex">
          <div className="w-5 min-h-[110px] relative bg-[#262421]">
            <div
              className="absolute bottom-0 left-0 right-0 bg-[#eeeeee] transition-all duration-300"
              style={{ height: `${whitePct}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[9px] font-bold mix-blend-difference text-white font-mono">
                {lines.length > 0 ? formatScore(lines[0]) : '0.0'}
              </span>
            </div>
          </div>

          <div className="flex-1 p-2 space-y-1 min-w-0">
            {lines.length === 0 && !isThinking && (
              <p className="text-[var(--muted)] text-xs">Waiting for analysis…</p>
            )}
            {lines.map((line, i) => (
              <div key={i} className="flex gap-2 text-xs font-mono">
                <span className="font-bold w-11 text-right shrink-0 text-[var(--foreground-strong)]">
                  {formatScore(line)}
                </span>
                <span className="text-[var(--muted)] truncate">{line.pv}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
