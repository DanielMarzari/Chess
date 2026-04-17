import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import {
  Settings as SettingsIcon,
  GraduationCap,
  BookOpen,
  Sparkles,
  Dumbbell,
  Compass,
  TrendingUp,
} from 'lucide-react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Chess',
  description: 'Chess training and analysis',
};

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
          <div className="max-w-7xl mx-auto px-4 h-12 flex items-center gap-1 overflow-x-auto">
            <Link
              href="/mentor"
              className="flex items-center gap-2 px-3 py-1.5 text-[var(--foreground-strong)] font-semibold shrink-0"
            >
              <span className="text-[var(--accent)] text-lg leading-none">♞</span>
              <span>Master</span>
            </Link>
            <div className="h-4 w-px bg-[var(--border)] mx-2 shrink-0" />
            <NavLink href="/mentor" Icon={GraduationCap}>
              Mentor
            </NavLink>
            <NavLink href="/analyze" Icon={BookOpen}>
              Analyze
            </NavLink>
            <NavLink href="/study" Icon={Sparkles}>
              Study
            </NavLink>
            <NavLink href="/train" Icon={Dumbbell}>
              Train
            </NavLink>
            <NavLink href="/explore" Icon={Compass}>
              Explore
            </NavLink>
            <NavLink href="/review" Icon={TrendingUp}>
              Review
            </NavLink>
            <Link
              href="/settings"
              title="Settings"
              className="ml-auto px-2 py-1.5 text-[var(--muted)] hover:text-[var(--foreground-strong)] hover:bg-[var(--surface-2)] rounded transition-colors shrink-0"
            >
              <SettingsIcon size={16} />
            </Link>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}

function NavLink({
  href,
  Icon,
  children,
}: {
  href: string;
  Icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="px-2.5 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground-strong)] hover:bg-[var(--surface-2)] rounded transition-colors flex items-center gap-1.5 shrink-0"
    >
      <Icon size={14} />
      {children}
    </Link>
  );
}
