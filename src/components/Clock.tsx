'use client';

import { formatTime } from '@/hooks/useClock';
import { Clock as ClockIcon } from 'lucide-react';

interface ClockDisplayProps {
  seconds: number;
  active: boolean;
  flagged: boolean;
  label: string;
}

export function ClockDisplay({ seconds, active, flagged, label }: ClockDisplayProps) {
  const low = seconds < 30;
  const critical = seconds < 10;

  return (
    <div
      className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded border transition-colors ${
        flagged
          ? 'bg-[var(--danger)]/15 border-[var(--danger)] text-[var(--danger)]'
          : active
          ? 'bg-[var(--accent)]/15 border-[var(--accent)] text-[var(--foreground-strong)]'
          : 'bg-[var(--surface)] border-[var(--border)] text-[var(--muted)]'
      }`}
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider">
        <ClockIcon size={12} />
        <span>{label}</span>
      </div>
      <span
        className={`font-mono font-bold text-xl tabular-nums ${
          critical ? 'text-[var(--danger)] animate-pulse' : low && active ? 'text-[var(--warning)]' : ''
        }`}
      >
        {flagged ? '0:00' : formatTime(seconds)}
      </span>
    </div>
  );
}
