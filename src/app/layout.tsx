import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import ThemeToggle from '@/components/ThemeToggle';
import './globals.css';

export const metadata: Metadata = {
  title: 'Chess',
  description: 'Chess training and analysis',
};

// Before-hydration script: apply stored theme immediately to avoid FOUC
const themeInitScript = `
(function() {
  try {
    var s = localStorage.getItem('theme');
    if (s === 'dark' || s === 'light') {
      document.documentElement.setAttribute('data-theme', s);
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
      </head>
      <body>
        <nav className="border-b border-[var(--border)] bg-[var(--surface)]">
          <div className="max-w-7xl mx-auto px-4 h-12 flex items-center gap-1">
            <Link
              href="/"
              className="flex items-center gap-2 px-3 py-1.5 text-[var(--foreground-strong)] font-semibold"
            >
              <span className="text-[var(--accent)] text-lg leading-none">♞</span>
              <span>Chess</span>
            </Link>
            <div className="h-4 w-px bg-[var(--border)] mx-2" />
            <NavLink href="/">Play</NavLink>
            <NavLink href="/games">Games</NavLink>
            <NavLink href="/puzzles">Puzzles</NavLink>
            <div className="ml-auto">
              <ThemeToggle />
            </div>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground-strong)] hover:bg-[var(--surface-2)] rounded transition-colors"
    >
      {children}
    </Link>
  );
}
