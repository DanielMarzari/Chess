'use client';

import { useEffect, useState } from 'react';
import ThemeToggle from '@/components/ThemeToggle';
import { Volume2, Palette, Square, GraduationCap, Type } from 'lucide-react';
import { writeSetting, type Notation } from '@/hooks/useSettings';
import { NAG_META } from '@/lib/accuracy';

const BOARD_THEMES = [
  { id: 'brown', label: 'Brown', light: '#f0d9b5', dark: '#b58863' },
  { id: 'blue', label: 'Blue', light: '#dee3e6', dark: '#8ca2ad' },
  { id: 'green', label: 'Green', light: '#eeeed2', dark: '#769656' },
  { id: 'purple', label: 'Purple', light: '#ede0ff', dark: '#7d5ba6' },
];

const PIECE_SETS = [
  { id: 'default', label: 'Cburnett (default)' },
  { id: 'merida', label: 'Merida' },
];

const NOTATIONS: { id: Notation; label: string; example: string }[] = [
  { id: 'san', label: 'Standard Algebraic', example: 'Nf3' },
  { id: 'figurine', label: 'Figurine', example: '♞f3' },
  { id: 'long', label: 'Long Algebraic', example: 'Ng1-f3' },
];

export default function SettingsPage() {
  const [boardTheme, setBoardTheme] = useState('brown');
  const [pieceSet, setPieceSet] = useState('default');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notation, setNotation] = useState<Notation>('san');
  const [coachOnBlunder, setCoachOnBlunder] = useState(true);
  const [coachOnMistake, setCoachOnMistake] = useState(true);
  const [coachOnInaccuracy, setCoachOnInaccuracy] = useState(true);
  const [coachOnPositional, setCoachOnPositional] = useState(false);

  useEffect(() => {
    setBoardTheme(localStorage.getItem('boardTheme') || 'brown');
    setPieceSet(localStorage.getItem('pieceSet') || 'default');
    setSoundEnabled(localStorage.getItem('soundEnabled') !== 'false');
    const ln = localStorage.getItem('notation');
    setNotation(ln === 'figurine' || ln === 'long' ? ln : 'san');
    setCoachOnBlunder(localStorage.getItem('coachOnBlunder') !== 'false');
    setCoachOnMistake(localStorage.getItem('coachOnMistake') !== 'false');
    setCoachOnInaccuracy(localStorage.getItem('coachOnInaccuracy') !== 'false');
    setCoachOnPositional(localStorage.getItem('coachOnPositional') === 'true');
  }, []);

  function update<T>(key: string, value: T, setter: (v: T) => void) {
    setter(value);
    localStorage.setItem(key, String(value));
    window.dispatchEvent(new CustomEvent('settings-changed'));
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <h1 className="text-xl font-bold">Settings</h1>

      {/* Appearance */}
      <section className="space-y-3">
        <h2 className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted)] border-b border-[var(--border)] pb-1">
          Appearance
        </h2>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Palette size={16} className="text-[var(--muted)]" />
            <span>Theme</span>
          </div>
          <ThemeToggle variant="full" />
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <Square size={16} className="text-[var(--muted)]" />
            <span>Board</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {BOARD_THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => update('boardTheme', t.id, setBoardTheme)}
                className={`rounded border-2 overflow-hidden transition-colors ${
                  boardTheme === t.id ? 'border-[var(--accent)]' : 'border-[var(--border)]'
                }`}
              >
                <div className="grid grid-cols-2 grid-rows-2 h-16">
                  <div style={{ background: t.light }} />
                  <div style={{ background: t.dark }} />
                  <div style={{ background: t.dark }} />
                  <div style={{ background: t.light }} />
                </div>
                <div className="text-xs text-center py-1 bg-[var(--surface)]">{t.label}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[var(--muted)] text-lg leading-none">♞</span>
            <span>Piece set</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {PIECE_SETS.map((s) => (
              <button
                key={s.id}
                onClick={() => update('pieceSet', s.id, setPieceSet)}
                className={`rounded border-2 p-2 text-sm transition-colors ${
                  pieceSet === s.id
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                    : 'border-[var(--border)] hover:border-[var(--muted)]'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-[var(--muted)] mt-2">
            The Merida piece set is coming in a future update.
          </p>
        </div>
      </section>

      {/* Notation */}
      <section className="space-y-3">
        <h2 className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted)] border-b border-[var(--border)] pb-1">
          Notation
        </h2>
        <div className="flex items-center gap-2 mb-2">
          <Type size={16} className="text-[var(--muted)]" />
          <span>Move list style</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {NOTATIONS.map((n) => (
            <button
              key={n.id}
              onClick={() => {
                setNotation(n.id);
                writeSetting('notation', n.id);
              }}
              className={`rounded border-2 p-3 transition-colors text-left ${
                notation === n.id
                  ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                  : 'border-[var(--border)] hover:border-[var(--muted)]'
              }`}
            >
              <div className="text-xs text-[var(--muted)] uppercase tracking-wider">{n.label}</div>
              <div className="font-mono text-sm mt-1">{n.example}</div>
            </button>
          ))}
        </div>
      </section>

      {/* Training */}
      <section className="space-y-3">
        <h2 className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted)] border-b border-[var(--border)] pb-1">
          Training (Coach)
        </h2>
        <div className="flex items-center gap-2 mb-2">
          <GraduationCap size={16} className="text-[var(--muted)]" />
          <span>When should the coach interrupt?</span>
        </div>
        <div className="space-y-2">
          <CoachToggle
            label="Blunders"
            description="Moves that lose a lot of material or miss mate"
            nag="blunder"
            checked={coachOnBlunder}
            onChange={(v) => {
              setCoachOnBlunder(v);
              writeSetting('coachOnBlunder', v);
            }}
          />
          <CoachToggle
            label="Mistakes"
            description="Moves that significantly worsen your position"
            nag="mistake"
            checked={coachOnMistake}
            onChange={(v) => {
              setCoachOnMistake(v);
              writeSetting('coachOnMistake', v);
            }}
          />
          <CoachToggle
            label="Inaccuracies"
            description="Small slips — the position still holds but there was better"
            nag="inaccuracy"
            checked={coachOnInaccuracy}
            onChange={(v) => {
              setCoachOnInaccuracy(v);
              writeSetting('coachOnInaccuracy', v);
            }}
          />
        </div>

        <div className="border-t border-[var(--border)] pt-3">
          <label className="flex items-start gap-3 p-2 rounded hover:bg-[var(--surface-2)]/50 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={coachOnPositional}
              onChange={(e) => {
                setCoachOnPositional(e.target.checked);
                writeSetting('coachOnPositional', e.target.checked);
              }}
              className="mt-1 w-4 h-4 accent-[var(--accent)] shrink-0"
            />
            <div className="flex-1">
              <div className="text-[var(--foreground-strong)] font-medium">
                Coach on positional mistakes
              </div>
              <div className="text-xs text-[var(--muted)] mt-0.5 leading-relaxed">
                When the engine prefers another move but no material is won or lost in the resulting line.
                Off by default — beginners benefit more from focusing on tactical errors that lose pieces.
                Turn on once you're comfortable spotting hanging pieces and want subtler feedback.
              </div>
            </div>
          </label>
        </div>
      </section>

      {/* Audio */}
      <section className="space-y-3">
        <h2 className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted)] border-b border-[var(--border)] pb-1">
          Audio
        </h2>
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <span className="flex items-center gap-2">
            <Volume2 size={16} className="text-[var(--muted)]" />
            Move sounds
          </span>
          <input
            type="checkbox"
            checked={soundEnabled}
            onChange={(e) => update('soundEnabled', e.target.checked, setSoundEnabled)}
            className="w-4 h-4 accent-[var(--accent)]"
          />
        </label>
      </section>

      {/* Keyboard shortcuts */}
      <section className="space-y-2">
        <h2 className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted)] border-b border-[var(--border)] pb-1">
          Keyboard shortcuts
        </h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          {[
            ['← →', 'Navigate moves'],
            ['Home / End', 'Jump to start/end'],
            ['F', 'Flip board'],
            ['N', 'New game'],
            ['U', 'Undo'],
            ['R', 'Resign'],
            ['S', 'Save game'],
            ['X', 'Copy PGN'],
            ['I', 'Import PGN'],
            ['Esc', 'Cancel premove / close'],
          ].map(([key, desc]) => (
            <div key={key} className="flex justify-between">
              <kbd className="font-mono text-xs bg-[var(--surface-2)] px-1.5 py-0.5 rounded">{key}</kbd>
              <span className="text-[var(--muted)]">{desc}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function CoachToggle({
  label,
  description,
  nag,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  nag: 'blunder' | 'mistake' | 'inaccuracy';
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const meta = NAG_META[nag];
  return (
    <label className="flex items-start gap-3 p-2 rounded hover:bg-[var(--surface-2)]/50 cursor-pointer transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 w-4 h-4 accent-[var(--accent)] shrink-0"
      />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ background: meta.color }}
          />
          <span className="text-[var(--foreground-strong)] font-medium">{label}</span>
          <span
            className="font-mono text-[10px] font-bold"
            style={{ color: meta.color }}
          >
            {meta.symbol}
          </span>
        </div>
        <div className="text-xs text-[var(--muted)] mt-0.5">{description}</div>
      </div>
    </label>
  );
}
