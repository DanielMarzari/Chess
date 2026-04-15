'use client';

import { useState } from 'react';
import { Cpu } from 'lucide-react';
import type { Square } from 'chess.js';
import type { EngineLineInfo } from '@/hooks/useStockfish';

export type { EngineLineInfo };

interface EngineAnalysisProps {
  lines: EngineLineInfo[];
  depth: number;
  isThinking: boolean;
  onHoverLine?: (move: { from: Square; to: Square } | null) => void;
}

function formatScore(line: EngineLineInfo): string {
  if (line.mate !== null) return line.mate >= 0 ? `M${line.mate}` : `-M${Math.abs(line.mate)}`;
  const score = line.score / 100;
  return score >= 0 ? `+${score.toFixed(2)}` : score.toFixed(2);
}

function firstMoveFromPv(pv: string): { from: Square; to: Square } | null {
  const first = pv.trim().split(/\s+/)[0];
  if (!first || first.length < 4) return null;
  return { from: first.slice(0, 2) as Square, to: first.slice(2, 4) as Square };
}

export default function EngineAnalysis({ lines, depth, isThinking, onHoverLine }: EngineAnalysisProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div
      className="bg-[var(--surface)] rounded border border-[var(--border)] overflow-hidden"
      onMouseLeave={() => {
        setHovered(null);
        onHoverLine?.(null);
      }}
    >
      <div className="px-3 py-2 border-b border-[var(--border)] flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-[var(--muted)]">
        <Cpu size={14} className="text-[var(--accent)]" />
        <span>Analysis {depth > 0 && `· d${depth}`}</span>
        {isThinking && (
          <span className="ml-auto text-[10px] normal-case text-[var(--accent)] animate-pulse">thinking…</span>
        )}
      </div>

      <div className="p-2 space-y-1 min-w-0">
        {lines.length === 0 && (
          <p className="text-[var(--muted)] text-xs">Waiting for engine…</p>
        )}
        {lines.map((line, i) => (
          <div
            key={i}
            className={`flex gap-2 text-xs font-mono rounded px-1 cursor-default transition-colors ${
              hovered === i ? 'bg-[var(--surface-2)]' : ''
            }`}
            onMouseEnter={() => {
              setHovered(i);
              onHoverLine?.(firstMoveFromPv(line.pv));
            }}
            onMouseLeave={() => {
              // Handled at container level for robustness
            }}
          >
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
