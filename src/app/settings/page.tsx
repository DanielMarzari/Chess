'use client';

import { useEffect, useState } from 'react';
import ThemeToggle from '@/components/ThemeToggle';
import { Check, Volume2, Palette, Square, GraduationCap, Type } from 'lucide-react';
import { useSettings, writeSetting, type Notation, type CoachingMode } from '@/hooks/useSettings';
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

// Shows a brief "Saved ✓" ping next to a setting after it's toggled.
function useSavedFlash() {
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const flash = (key: string) => {
    setFlashKey(key);
    setTimeout(() => {
      setFlashKey((cur) => (cur === key ? null : cur));
    }, 1400);
  };
  return { flashKey, flash };
}

function SavedBadge({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] text-[var(--success)] font-semibold animate-in fade-in ml-2">
      <Check size={10} /> saved
    </span>
  );
}

export default function SettingsPage() {
  // Source-of-truth for settings is useSettings (reads localStorage and
  // listens for the 'settings-changed' event dispatched by writeSetting).
  // This guarantees the UI reflects whatever's actually persisted, with
  // no risk of drift from a separate React-state copy.
  const settings = useSettings();
  const { flashKey, flash } = useSavedFlash();

  const [boardTheme, setBoardTheme] = useState('brown');
  const [pieceSet, setPieceSet] = useState('default');
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    setBoardTheme(localStorage.getItem('boardTheme') || 'brown');
    setPieceSet(localStorage.getItem('pieceSet') || 'default');
    setSoundEnabled(localStorage.getItem('soundEnabled') !== 'false');
  }, []);

  function updateLocal<T>(key: string, value: T, setter: (v: T) => void) {
    setter(value);
    localStorage.setItem(key, String(value));
    window.dispatchEvent(new CustomEvent('settings-changed'));
    flash(key);
  }

  function toggleCoachNag(key: 'coachOnBlunder' | 'coachOnMistake' | 'coachOnInaccuracy') {
    const current = settings[key];
    writeSetting(key, !current);
    flash(key);
  }

  function toggleCoachPositional() {
    writeSetting('coachOnPositional', !settings.coachOnPositional);
    flash('coachOnPositional');
  }

  function setNotation(value: Notation) {
    writeSetting('notation', value);
    flash('notation');
  }

  function setCoachingMode(value: CoachingMode) {
    writeSetting('coachingMode', value);
    flash('coachingMode');
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
            <SavedBadge visible={flashKey === 'boardTheme'} />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {BOARD_THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => updateLocal('boardTheme', t.id, setBoardTheme)}
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
            <SavedBadge visible={flashKey === 'pieceSet'} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {PIECE_SETS.map((s) => (
              <button
                key={s.id}
                onClick={() => updateLocal('pieceSet', s.id, setPieceSet)}
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
          <SavedBadge visible={flashKey === 'notation'} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {NOTATIONS.map((n) => (
            <button
              key={n.id}
              onClick={() => setNotation(n.id)}
              className={`rounded border-2 p-3 transition-colors text-left ${
                settings.notation === n.id
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

        {/* Coaching Mode */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <GraduationCap size={16} className="text-[var(--muted)]" />
            <span>When to coach</span>
            <SavedBadge visible={flashKey === 'coachingMode'} />
          </div>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {(['live', 'review', 'both'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setCoachingMode(mode)}
                className={`rounded border-2 p-3 transition-colors text-left text-sm ${
                  settings.coachingMode === mode
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                    : 'border-[var(--border)] hover:border-[var(--muted)]'
                }`}
              >
                <div className="font-medium text-xs uppercase tracking-wider">
                  {mode === 'live'
                    ? 'Live'
                    : mode === 'review'
                    ? 'Review'
                    : 'Both'}
                </div>
                <div className="text-xs text-[var(--muted)] mt-1">
                  {mode === 'live'
                    ? 'During game'
                    : mode === 'review'
                    ? 'After game'
                    : 'Both times'}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium">Which moves to coach on</span>
        </div>
        <div className="space-y-1">
          <CoachToggleButton
            label="Blunders"
            description="Moves that lose a lot of material or miss mate"
            nag="blunder"
            checked={settings.coachOnBlunder}
            onToggle={() => toggleCoachNag('coachOnBlunder')}
            saved={flashKey === 'coachOnBlunder'}
          />
          <CoachToggleButton
            label="Mistakes"
            description="Moves that significantly worsen your position"
            nag="mistake"
            checked={settings.coachOnMistake}
            onToggle={() => toggleCoachNag('coachOnMistake')}
            saved={flashKey === 'coachOnMistake'}
          />
          <CoachToggleButton
            label="Inaccuracies"
            description="Small slips — the position still holds but there was better"
            nag="inaccuracy"
            checked={settings.coachOnInaccuracy}
            onToggle={() => toggleCoachNag('coachOnInaccuracy')}
            saved={flashKey === 'coachOnInaccuracy'}
          />
        </div>

        <div className="border-t border-[var(--border)] pt-3">
          <button
            onClick={toggleCoachPositional}
            className="w-full flex items-start gap-3 p-2 rounded hover:bg-[var(--surface-2)]/50 transition-colors text-left"
          >
            <span
              className={`mt-1 w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors ${
                settings.coachOnPositional
                  ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                  : 'bg-[var(--surface)] border-[var(--border)]'
              }`}
            >
              {settings.coachOnPositional && <Check size={11} strokeWidth={3} />}
            </span>
            <div className="flex-1">
              <div className="flex items-center">
                <span className="text-[var(--foreground-strong)] font-medium">
                  Coach on positional mistakes
                </span>
                <SavedBadge visible={flashKey === 'coachOnPositional'} />
              </div>
              <div className="text-xs text-[var(--muted)] mt-0.5 leading-relaxed">
                When the engine prefers another move but no material is won or lost in the
                resulting line. Off by default — beginners benefit more from focusing on tactical
                errors that lose pieces. Turn on once you're comfortable spotting hanging pieces
                and want subtler feedback.
              </div>
            </div>
          </button>
        </div>
      </section>

      {/* Audio */}
      <section className="space-y-3">
        <h2 className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted)] border-b border-[var(--border)] pb-1">
          Audio
        </h2>
        <button
          onClick={() => updateLocal('soundEnabled', !soundEnabled, setSoundEnabled)}
          className="w-full flex items-center justify-between gap-4 p-2 rounded hover:bg-[var(--surface-2)]/50 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Volume2 size={16} className="text-[var(--muted)]" />
            Move sounds
            <SavedBadge visible={flashKey === 'soundEnabled'} />
          </span>
          <span
            className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
              soundEnabled
                ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                : 'bg-[var(--surface)] border-[var(--border)]'
            }`}
          >
            {soundEnabled && <Check size={11} strokeWidth={3} />}
          </span>
        </button>
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

function CoachToggleButton({
  label,
  description,
  nag,
  checked,
  onToggle,
  saved,
}: {
  label: string;
  description: string;
  nag: 'blunder' | 'mistake' | 'inaccuracy';
  checked: boolean;
  onToggle: () => void;
  saved: boolean;
}) {
  const meta = NAG_META[nag];
  return (
    <button
      onClick={onToggle}
      type="button"
      className="w-full flex items-start gap-3 p-2 rounded hover:bg-[var(--surface-2)]/50 transition-colors text-left"
    >
      <span
        className={`mt-1 w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors ${
          checked
            ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
            : 'bg-[var(--surface)] border-[var(--border)]'
        }`}
        aria-checked={checked}
        role="checkbox"
      >
        {checked && <Check size={11} strokeWidth={3} />}
      </span>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ background: meta.color }}
          />
          <span className="text-[var(--foreground-strong)] font-medium">{label}</span>
          <span className="font-mono text-[10px] font-bold" style={{ color: meta.color }}>
            {meta.symbol}
          </span>
          <SavedBadge visible={saved} />
        </div>
        <div className="text-xs text-[var(--muted)] mt-0.5">{description}</div>
      </div>
    </button>
  );
}
