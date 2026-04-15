'use client';

import { useState, useEffect, useRef } from 'react';

interface AnnotationEditorProps {
  value: string;
  x: number;
  y: number;
  onSave: (value: string) => void;
  onCancel: () => void;
}

export default function AnnotationEditor({ value, x, y, onSave, onCancel }: AnnotationEditorProps) {
  const [text, setText] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    textareaRef.current?.select();
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const el = (e.target as HTMLElement).closest('[data-annotation-editor]');
      if (!el) onCancel();
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [onCancel]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onCancel();
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSave(text);
  }

  return (
    <div
      data-annotation-editor
      style={{ top: y, left: x }}
      className="fixed z-50 bg-[var(--surface)] border border-[var(--border)] rounded shadow-xl p-2 w-64"
    >
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Note on this move..."
        className="w-full px-2 py-1 bg-[var(--background)] border border-[var(--border)] rounded text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        rows={3}
      />
      <div className="flex justify-between items-center mt-1">
        <span className="text-[10px] text-[var(--muted)]">⌘+Enter to save · Esc to cancel</span>
        <div className="flex gap-1">
          {value && (
            <button
              onClick={() => onSave('')}
              className="text-[10px] px-2 py-0.5 text-[var(--danger)] hover:bg-[var(--danger)]/15 rounded"
            >
              Delete
            </button>
          )}
          <button
            onClick={() => onSave(text)}
            className="text-[10px] px-2 py-0.5 bg-[var(--accent)] text-white rounded hover:bg-[var(--accent-hover)]"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
