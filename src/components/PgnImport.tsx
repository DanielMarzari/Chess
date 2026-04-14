'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

interface PgnImportProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (pgn: string) => void;
}

export default function PgnImport({ isOpen, onClose, onImport }: PgnImportProps) {
  const [pgn, setPgn] = useState('');

  if (!isOpen) return null;

  function handleImport() {
    if (pgn.trim()) {
      onImport(pgn.trim());
      setPgn('');
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
          rows={12}
          className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          autoFocus
        />
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
