'use client';

import { useState } from 'react';
import { TIME_PRESETS, type TimeControl } from '@/hooks/useClock';
import { Clock, X } from 'lucide-react';

interface TimeControlPickerProps {
  currentTc: TimeControl | null;
  onSelect: (tc: TimeControl | null) => void;
}

export default function TimeControlPicker({ currentTc, onSelect }: TimeControlPickerProps) {
  const [open, setOpen] = useState(false);

  const groups = [
    { label: 'Bullet', filter: (t: TimeControl) => t.initialSeconds < 180 },
    { label: 'Blitz', filter: (t: TimeControl) => t.initialSeconds >= 180 && t.initialSeconds < 600 },
    { label: 'Rapid', filter: (t: TimeControl) => t.initialSeconds >= 600 && t.initialSeconds < 1500 },
    { label: 'Classical', filter: (t: TimeControl) => t.initialSeconds >= 1500 },
  ];

  return (
    <div className="bg-[var(--surface)] rounded border border-[var(--border)]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-3 py-2 flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold hover:bg-[var(--surface-2)] transition-colors"
      >
        <Clock size={14} className={currentTc ? 'text-[var(--accent)]' : 'text-[var(--muted)]'} />
        <span className={currentTc ? 'text-[var(--foreground-strong)]' : 'text-[var(--muted)]'}>
          Time {currentTc ? `· ${currentTc.label}` : '(untimed)'}
        </span>
      </button>
      {open && (
        <div className="border-t border-[var(--border)] p-2 space-y-2">
          {currentTc && (
            <button
              onClick={() => {
                onSelect(null);
                setOpen(false);
              }}
              className="flex items-center gap-1 text-[11px] text-[var(--muted)] hover:text-[var(--foreground-strong)]"
            >
              <X size={12} /> Remove clock
            </button>
          )}
          {groups.map((group) => {
            const presets = TIME_PRESETS.filter(group.filter);
            if (presets.length === 0) return null;
            return (
              <div key={group.label}>
                <div className="text-[9px] uppercase tracking-wider text-[var(--muted)] mb-1">
                  {group.label}
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {presets.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => {
                        onSelect(p);
                        setOpen(false);
                      }}
                      className={`py-1 text-xs rounded font-mono transition-colors ${
                        currentTc?.label === p.label
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
      )}
    </div>
  );
}
