'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

type ThemeSetting = 'auto' | 'dark' | 'light';

function resolveEffective(setting: ThemeSetting): 'dark' | 'light' {
  if (setting === 'dark' || setting === 'light') return setting;
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
  return 'dark';
}

export function useTheme() {
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

  const update = (s: ThemeSetting) => {
    setSetting(s);
    localStorage.setItem('theme', s);
    applyTheme(s);
  };

  return { setting, setSetting: update, effective: resolveEffective(setting) };
}

export default function ThemeToggle({ variant = 'icon' }: { variant?: 'icon' | 'full' }) {
  const { setting, setSetting, effective } = useTheme();

  if (variant === 'icon') {
    // Icon reflects the *target* state (what clicking will switch to)
    const isLight = effective === 'light';
    const Icon = isLight ? Moon : Sun;
    return (
      <button
        onClick={() => setSetting(isLight ? 'dark' : 'light')}
        title={`Switch to ${isLight ? 'dark' : 'light'} mode`}
        className="px-2 py-1.5 rounded text-[var(--muted)] hover:text-[var(--foreground-strong)] hover:bg-[var(--surface-2)] transition-colors"
      >
        <Icon size={16} />
      </button>
    );
  }

  // Full variant (used on settings page)
  const options: { value: ThemeSetting; label: string; Icon: typeof Sun }[] = [
    { value: 'auto', label: 'Auto', Icon: Sun },
    { value: 'light', label: 'Light', Icon: Sun },
    { value: 'dark', label: 'Dark', Icon: Moon },
  ];

  return (
    <div className="inline-flex rounded overflow-hidden border border-[var(--border)]">
      {options.map(({ value, label, Icon }) => (
        <button
          key={value}
          onClick={() => setSetting(value)}
          className={`px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors ${
            setting === value
              ? 'bg-[var(--accent)] text-white'
              : 'bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground-strong)]'
          }`}
        >
          {value !== 'auto' && <Icon size={12} />}
          {label}
        </button>
      ))}
    </div>
  );
}
