'use client';

import { useEffect, useState } from 'react';

export type Notation = 'san' | 'figurine' | 'long';

export interface Settings {
  coachOnBlunder: boolean;
  coachOnMistake: boolean;
  coachOnInaccuracy: boolean;
  notation: Notation;
}

const DEFAULTS: Settings = {
  coachOnBlunder: true,
  coachOnMistake: true,
  coachOnInaccuracy: true,
  notation: 'san',
};

function read(): Settings {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const ln = localStorage.getItem('notation');
    const notation: Notation = ln === 'figurine' || ln === 'long' ? ln : 'san';
    return {
      coachOnBlunder: localStorage.getItem('coachOnBlunder') !== 'false',
      coachOnMistake: localStorage.getItem('coachOnMistake') !== 'false',
      coachOnInaccuracy: localStorage.getItem('coachOnInaccuracy') !== 'false',
      notation,
    };
  } catch {
    return DEFAULTS;
  }
}

/**
 * Read-mostly settings hook. Settings are persisted to localStorage by the
 * settings page; anywhere else that consumes them gets live updates via the
 * `storage` event (cross-tab) and a `settings-changed` custom event (same-tab).
 */
export function useSettings(): Settings {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);

  useEffect(() => {
    setSettings(read());
    const sync = () => setSettings(read());
    window.addEventListener('storage', sync);
    window.addEventListener('settings-changed', sync as EventListener);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('settings-changed', sync as EventListener);
    };
  }, []);

  return settings;
}

// Helper used by the Settings page to persist + announce a change.
export function writeSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  try {
    localStorage.setItem(key, String(value));
    window.dispatchEvent(new CustomEvent('settings-changed'));
  } catch {
    // noop
  }
}
