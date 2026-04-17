'use client';

import { Play, Users, Bot, GraduationCap } from 'lucide-react';
import { TIME_PRESETS, type TimeControl } from '@/hooks/useClock';
import type { OpponentColor } from '@/hooks/useStockfish';

export type GameMode = 'cpu' | 'free' | 'coach';

const ELO_PRESETS: { label: string; elo: number; title?: boolean }[] = [
  { label: 'Beginner', elo: 800 },
  { label: 'Novice', elo: 1200 },
  { label: 'Intermediate', elo: 1600 },
  { label: 'Advanced', elo: 2000 },
  { label: 'CM', elo: 2200, title: true },
  { label: 'FM', elo: 2300, title: true },
  { label: 'IM', elo: 2400, title: true },
  { label: 'GM', elo: 2500, title: true },
];

interface SetupPanelProps {
  mode: GameMode;
  onModeChange: (m: GameMode) => void;
  cpuColor: OpponentColor;
  onCpuColorChange: (c: OpponentColor) => void;
  cpuElo: number;
  onCpuEloChange: (elo: number) => void;
  tc: TimeControl | null;
  onTcChange: (tc: TimeControl | null) => void;
  onStart: () => void;
  allowedModes?: GameMode[];
  tabLabel?: string;
}

export default function SetupPanel({
  mode,
  onModeChange,
  cpuColor,
  onCpuColorChange,
  cpuElo,
  onCpuEloChange,
  tc,
  onTcChange,
  onStart,
  allowedModes = ['cpu', 'coach', 'free'],
  tabLabel,
}: SetupPanelProps) {
  const showModeSelector = allowedModes.length > 1;
  const tcGroups = [
    { label: 'Bullet', filter: (t: TimeControl) => t.initialSeconds < 180 },
    { label: 'Blitz', filter: (t: TimeControl) => t.initialSeconds >= 180 && t.initialSeconds < 600 },
    { label: 'Rapid', filter: (t: TimeControl) => t.initialSeconds >= 600 && t.initialSeconds < 1500 },
    { label: 'Classical', filter: (t: TimeControl) => t.initialSeconds >= 1500 },
  ];

  return (
    <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-5 space-y-5 w-full max-w-md shadow-xl">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
        <h2 className="text-lg font-bold">{tabLabel ?? 'New Game'}</h2>
      </div>

      {/* Mode (only shown when multiple modes are allowed) */}
      {showModeSelector && (
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold">
            Mode
          </label>
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${allowedModes.length}, minmax(0, 1fr))` }}
          >
            {allowedModes.includes('cpu') && (
              <button
                onClick={() => onModeChange('cpu')}
                className={`py-3 px-2 rounded flex flex-col items-center justify-center gap-1 transition-colors ${
                  mode === 'cpu'
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--foreground-strong)]'
                }`}
              >
                <Bot size={18} />
                <span className="text-xs font-semibold">vs Computer</span>
              </button>
            )}
            {allowedModes.includes('coach') && (
              <button
                onClick={() => onModeChange('coach')}
                className={`py-3 px-2 rounded flex flex-col items-center justify-center gap-1 transition-colors ${
                  mode === 'coach'
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--foreground-strong)]'
                }`}
              >
                <GraduationCap size={18} />
                <span className="text-xs font-semibold">Training</span>
              </button>
            )}
            {allowedModes.includes('free') && (
              <button
                onClick={() => onModeChange('free')}
                className={`py-3 px-2 rounded flex flex-col items-center justify-center gap-1 transition-colors ${
                  mode === 'free'
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--foreground-strong)]'
                }`}
              >
                <Users size={18} />
                <span className="text-xs font-semibold">Free Play</span>
              </button>
            )}
          </div>
        </div>
      )}

      {mode === 'coach' && (
        <p className="text-[11px] text-[var(--muted)] leading-relaxed bg-[var(--surface-2)] rounded p-2">
          <span className="text-[var(--accent)] font-semibold">Training mode:</span> Play vs the
          computer with a coach watching over your shoulder. On any inaccuracy, mistake, or
          blunder, the game pauses. The coach explains what you missed and gives you 3 tries
          to find a better move before revealing the best one.
        </p>
      )}

      {/* CPU-specific settings (also shown for coach mode) */}
      {(mode === 'cpu' || mode === 'coach') && (
        <>
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold">
              You play
            </label>
            <div className="grid grid-cols-3 gap-1">
              {(['black', 'white', 'random'] as OpponentColor[]).map((cpuC) => {
                // cpuC is what the COMPUTER plays; the button shows the HUMAN's color
                const youColor =
                  cpuC === 'white' ? 'Black' : cpuC === 'black' ? 'White' : 'Random';
                return (
                  <button
                    key={cpuC}
                    onClick={() => onCpuColorChange(cpuC)}
                    className={`py-2 text-xs rounded transition-colors ${
                      cpuColor === cpuC
                        ? 'bg-[var(--accent)] text-white font-semibold'
                        : 'bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--foreground-strong)]'
                    }`}
                  >
                    {youColor}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold">
                Strength
              </label>
              <span className="font-mono text-sm text-[var(--foreground-strong)]">{cpuElo} ELO</span>
            </div>
            <input
              type="range"
              min={800}
              max={3000}
              step={50}
              value={cpuElo}
              onChange={(e) => onCpuEloChange(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="grid grid-cols-4 gap-1">
              {ELO_PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => onCpuEloChange(p.elo)}
                  title={`${p.elo} ELO`}
                  className={`py-1 text-[11px] rounded transition-colors ${
                    Math.abs(cpuElo - p.elo) < 50
                      ? 'bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]'
                      : 'bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--foreground-strong)] border border-transparent'
                  } ${p.title ? 'font-mono font-semibold' : ''}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Time control */}
      <div className="space-y-2">
        <label className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold">
          Time Control
        </label>
        <button
          onClick={() => onTcChange(null)}
          className={`w-full py-1.5 text-xs rounded transition-colors ${
            tc === null
              ? 'bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]'
              : 'bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--foreground-strong)] border border-transparent'
          }`}
        >
          Untimed
        </button>
        {tcGroups.map((group) => {
          const presets = TIME_PRESETS.filter(group.filter);
          if (!presets.length) return null;
          return (
            <div key={group.label}>
              <div className="text-[9px] uppercase tracking-wider text-[var(--muted)] mb-1">
                {group.label}
              </div>
              <div className="grid grid-cols-4 gap-1">
                {presets.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => onTcChange(p)}
                    className={`py-1.5 text-xs font-mono rounded transition-colors ${
                      tc?.label === p.label
                        ? 'bg-[var(--accent)] text-white font-semibold'
                        : 'bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--foreground-strong)]'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Start */}
      <button
        onClick={onStart}
        className="w-full py-3 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold transition-colors flex items-center justify-center gap-2 text-sm uppercase tracking-wider"
      >
        <Play size={16} /> Start Game
      </button>
    </div>
  );
}
