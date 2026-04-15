'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';

type ThemeSetting = 'auto' | 'dark' | 'light';

export default function ThemeToggle() {
  const [setting, setSetting] = useState<ThemeSetting>('auto');

  useEffect(() => {
    const stored = (localStorage.getItem('theme') as ThemeSetting) || 'auto';
    setSetting(stored);
    applyTheme(stored);
  }, []);

  function applyTheme(s: ThemeSetting) {
    if (s === 'auto') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', s);
    }
  }

  function cycle() {
    const next: ThemeSetting = setting === 'auto' ? 'dark' : setting === 'dark' ? 'light' : 'auto';
    setSetting(next);
    localStorage.setItem('theme', next);
    applyTheme(next);
  }

  const Icon = setting === 'auto' ? Monitor : setting === 'dark' ? Moon : Sun;

  return (
    <button
      onClick={cycle}
      title={`Theme: ${setting}`}
      className="px-2 py-1.5 rounded text-[var(--muted)] hover:text-[var(--foreground-strong)] hover:bg-[var(--surface-2)] transition-colors"
    >
      <Icon size={16} />
    </button>
  );
}
