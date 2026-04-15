'use client';

import { Bot } from 'lucide-react';
import type { OpponentColor } from '@/hooks/useStockfish';

interface OpponentPanelProps {
  enabled: boolean;
  onToggle: () => void;
  color: OpponentColor;
  onColorChange: (color: OpponentColor) => void;
  elo: number;
  onEloChange: (elo: number) => void;
  isThinking: boolean;
  locked?: boolean; // disables settings changes during an active game
}

const PRESETS: { label: string; elo: number; title?: boolean }[] = [
  { label: 'Beginner', elo: 800 },
  { label: 'Novice', elo: 1200 },
  { label: 'Intermediate', elo: 1600 },
  { label: 'Advanced', elo: 2000 },
  { label: 'CM', elo: 2200, title: true },
  { label: 'FM', elo: 2300, title: true },
  { label: 'IM', elo: 2400, title: true },
  { label: 'GM', elo: 2500, title: true },
];

export default function OpponentPanel({
  enabled,
  onToggle,
  color,
  onColorChange,
  elo,
  onEloChange,
  isThinking,
  locked = false,
}: OpponentPanelProps) {
  return (
    <div className="bg-[var(--surface)] rounded border border-[var(--border)] overflow-hidden">
      <button
        onClick={onToggle}
        disabled={locked}
        className="w-full px-3 py-2 border-b border-[var(--border)] flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold hover:bg-[var(--surface-2)] transition-colors disabled:opacity-70 disabled:hover:bg-transparent disabled:cursor-not-allowed"
      >
        <Bot size={14} className={enabled ? 'text-[var(--accent)]' : 'text-[var(--muted)]'} />
        <span className={enabled ? 'text-[var(--foreground-strong)]' : 'text-[var(--muted)]'}>
          Computer opponent {enabled && `· ${elo}`}
        </span>
        {locked && <span className="ml-auto text-[9px] normal-case text-[var(--muted)]">locked</span>}
        {!locked && isThinking && (
          <span className="ml-auto text-[10px] normal-case text-[var(--accent)] animate-pulse">thinking…</span>
        )}
      </button>

      {enabled && (
        <div className={`p-3 space-y-3 ${locked ? 'opacity-60 pointer-events-none' : ''}`}>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1.5">
              Computer plays
            </div>
            <div className="grid grid-cols-3 gap-1">
              {(['white', 'black', 'random'] as OpponentColor[]).map((c) => (
                <button
                  key={c}
                  onClick={() => onColorChange(c)}
                  disabled={locked}
                  className={`py-1.5 text-xs rounded capitalize transition-colors ${
                    color === c
                      ? 'bg-[var(--accent)] text-white font-semibold'
                      : 'bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--foreground-strong)]'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Strength</span>
              <span className="font-mono text-sm text-[var(--foreground-strong)]">{elo} ELO</span>
            </div>
            <input
              type="range"
              min={800}
              max={3000}
              step={50}
              value={elo}
              onChange={(e) => onEloChange(parseInt(e.target.value))}
              disabled={locked}
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-4 gap-1">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => onEloChange(p.elo)}
                disabled={locked}
                title={`${p.elo} ELO`}
                className={`py-1 text-[11px] rounded transition-colors ${
                  Math.abs(elo - p.elo) < 50
                    ? 'bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]'
                    : 'bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--foreground-strong)] border border-transparent'
                } ${p.title ? 'font-mono font-semibold' : ''}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
