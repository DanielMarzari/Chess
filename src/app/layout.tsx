import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Chess',
  description: 'Chess training and analysis',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="border-b border-[var(--border)] bg-[var(--surface)]">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-6">
            <Link href="/" className="text-lg font-bold text-[var(--accent)]">
              Chess
            </Link>
            <Link href="/" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
              Board
            </Link>
            <Link
              href="/games"
              className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              Games
            </Link>
            <Link
              href="/puzzles"
              className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              Puzzles
            </Link>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
