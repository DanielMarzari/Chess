'use client';

import { BarChart3 } from 'lucide-react';
import { NAG_META, type NagType } from '@/lib/accuracy';

interface LiveStatsProps {
  nags: (NagType | null)[];
  whiteAccuracy: number | null;
  blackAccuracy: number | null;
  moveCount: number;
}

function countByColor(nags: (NagType | null)[]): {
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

export default function LiveStats({ nags, whiteAccuracy, blackAccuracy, moveCount }: LiveStatsProps) {
  if (moveCount === 0) return null;

  const { w: whiteNags, b: blackNags } = countByColor(nags);

  const nagRows: { type: NagType; label: string }[] = [
    { type: 'blunder', label: 'Blunder' },
    { type: 'mistake', label: 'Mistake' },
    { type: 'inaccuracy', label: 'Inaccuracy' },
  ];

  return (
    <div className="bg-[var(--surface)] rounded border border-[var(--border)] overflow-hidden">
      <div className="px-3 py-2 border-b border-[var(--border)] flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-[var(--muted)]">
        <BarChart3 size={14} className="text-[var(--accent)]" />
        <span>Stats</span>
      </div>
      <div className="p-3 space-y-2">
        {/* Accuracy row */}
        <div className="grid grid-cols-[auto_1fr_1fr] gap-x-3 items-center text-xs">
          <span className="text-[var(--muted)] uppercase tracking-wider text-[10px]">Accuracy</span>
          <div className="text-center">
            <div className="font-mono text-sm font-bold text-[var(--foreground-strong)]">
              {whiteAccuracy !== null ? `${whiteAccuracy.toFixed(0)}%` : '—'}
            </div>
            <div className="text-[9px] text-[var(--muted)] uppercase tracking-wider">White</div>
          </div>
          <div className="text-center">
            <div className="font-mono text-sm font-bold text-[var(--foreground-strong)]">
              {blackAccuracy !== null ? `${blackAccuracy.toFixed(0)}%` : '—'}
            </div>
            <div className="text-[9px] text-[var(--muted)] uppercase tracking-wider">Black</div>
          </div>
        </div>

        <div className="h-px bg-[var(--border)]" />

        {/* NAG rows */}
        <div className="grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-1 items-center text-xs">
          {nagRows.map((row) => {
            const wCount = whiteNags[row.type] || 0;
            const bCount = blackNags[row.type] || 0;
            const color = NAG_META[row.type].color;
            const symbol = NAG_META[row.type].symbol;
            return (
              <div key={row.type} className="contents">
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ background: color }}
                  />
                  <span className="text-[var(--foreground)]">{row.label}</span>
                  <span
                    className="font-mono text-[10px] opacity-60"
                    style={{ color }}
                  >
                    {symbol}
                  </span>
                </span>
                <span
                  className="text-center font-mono tabular-nums"
                  style={{ color: wCount ? color : undefined, opacity: wCount ? 1 : 0.4 }}
                >
                  {wCount}
                </span>
                <span
                  className="text-center font-mono tabular-nums"
                  style={{ color: bCount ? color : undefined, opacity: bCount ? 1 : 0.4 }}
                >
                  {bCount}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
