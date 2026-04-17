'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

// The imported color tells PlayView which side the user actually played so
// the NAG stats, coach triggers, and encouragement toasts can be attributed
// correctly. 'viewer' means the user didn't play the game — they just want
// to analyze it (both sides are "not me").
export type ImportPerspective = 'w' | 'b' | 'viewer';

interface PgnImportProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (pgn: string, perspective: ImportPerspective) => void;
}

export default function PgnImport({ isOpen, onClose, onImport }: PgnImportProps) {
  const [pgn, setPgn] = useState('');
  const [perspective, setPerspective] = useState<ImportPerspective>('viewer');

  if (!isOpen) return null;

  function handleImport() {
    if (pgn.trim()) {
      onImport(pgn.trim(), perspective);
      setPgn('');
      setPerspective('viewer');
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-[var(--surface)] rounded-xl border border-[var(--border)] w-full max-w-lg p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Import PGN</h2>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--foreground)]">
            <X size={20} />
          </button>
        </div>
        <textarea
          value={pgn}
          onChange={(e) => setPgn(e.target.value)}
          placeholder="Paste PGN here..."
          rows={10}
          className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          autoFocus
        />

        {/* Perspective picker — determines whose moves get coached and
            which color's stats show up as "yours" at the end. */}
        <div className="space-y-1.5">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted)]">
            Which side did you play?
          </div>
          <div className="grid grid-cols-3 gap-2">
            <PerspectiveOption
              label="White"
              icon="○"
              selected={perspective === 'w'}
              onClick={() => setPerspective('w')}
            />
            <PerspectiveOption
              label="Black"
              icon="●"
              selected={perspective === 'b'}
              onClick={() => setPerspective('b')}
            />
            <PerspectiveOption
              label="Just analyze"
              icon="∞"
              selected={perspective === 'viewer'}
              onClick={() => setPerspective('viewer')}
            />
          </div>
          <p className="text-[10px] text-[var(--muted)]">
            Pick your side to get coached retrospectively on your own moves. Choose "Just analyze"
            if you're reviewing someone else's game.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!pgn.trim()}
            className="px-4 py-2 rounded-lg text-sm bg-[var(--primary)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}

function PerspectiveOption({
  label,
  icon,
  selected,
  onClick,
}: {
  label: string;
  icon: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded border text-sm transition-colors ${
        selected
          ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--foreground-strong)]'
          : 'border-[var(--border)] hover:border-[var(--accent)]/50 text-[var(--foreground)]'
      }`}
    >
      <span className="text-xl leading-none">{icon}</span>
      <span className="text-xs">{label}</span>
    </button>
  );
}
