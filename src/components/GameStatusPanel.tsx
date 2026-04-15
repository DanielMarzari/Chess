'use client';

import { Bot, Users, Flag, XCircle, GraduationCap } from 'lucide-react';
import type { TimeControl } from '@/hooks/useClock';
import type { GameMode } from './SetupPanel';

interface GameStatusPanelProps {
  mode: GameMode;
  cpuColor: 'w' | 'b' | null; // resolved color the CPU actually plays
  cpuElo: number;
  tc: TimeControl | null;
  isCpuThinking: boolean;
  onQuit: () => void;
  onResign: () => void;
  canResign: boolean;
  phase: 'playing' | 'ended';
}

export default function GameStatusPanel({
  mode,
  cpuColor,
  cpuElo,
  tc,
  isCpuThinking,
  onQuit,
  onResign,
  canResign,
  phase,
}: GameStatusPanelProps) {
  return (
    <div className="bg-[var(--surface)] rounded border border-[var(--border)] overflow-hidden">
      <div className="px-3 py-2 border-b border-[var(--border)] flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-[var(--muted)]">
        {mode === 'coach' ? (
          <GraduationCap size={14} className="text-[var(--accent)]" />
        ) : mode === 'cpu' ? (
          <Bot size={14} className="text-[var(--accent)]" />
        ) : (
          <Users size={14} />
        )}
        <span>{phase === 'ended' ? 'Game Over' : 'In Progress'}</span>
        {phase === 'playing' && isCpuThinking && (
          <span className="ml-auto text-[10px] normal-case text-[var(--accent)] animate-pulse">
            CPU thinking…
          </span>
        )}
      </div>
      <div className="p-3 space-y-2 text-sm">
        {(mode === 'cpu' || mode === 'coach') && cpuColor && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--muted)]">Opponent</span>
            <span className="text-[var(--foreground-strong)] font-mono">
              CPU {cpuElo} · {cpuColor === 'w' ? 'White' : 'Black'}
            </span>
          </div>
        )}
        {mode === 'coach' && (
          <div className="text-[var(--accent)] text-[11px] bg-[var(--accent)]/10 rounded px-2 py-1">
            Coach active — you'll be stopped on blunders, mistakes, and inaccuracies.
          </div>
        )}
        {mode === 'free' && (
          <div className="text-[var(--muted)] text-xs">
            Free play — you control both sides.
          </div>
        )}
        {tc && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--muted)]">Time</span>
            <span className="font-mono text-[var(--foreground-strong)]">{tc.label}</span>
          </div>
        )}

        {phase === 'playing' && (mode === 'cpu' || mode === 'coach') && (
          <button
            onClick={onResign}
            disabled={!canResign}
            className="w-full py-1.5 rounded text-xs flex items-center justify-center gap-1.5 bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Flag size={12} /> Resign
          </button>
        )}

        <button
          onClick={onQuit}
          className="w-full py-1.5 rounded text-xs flex items-center justify-center gap-1.5 bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--foreground-strong)] hover:bg-[var(--border)] transition-colors"
        >
          <XCircle size={12} /> {phase === 'ended' ? 'New Game' : 'Quit & New Game'}
        </button>
      </div>
    </div>
  );
}
