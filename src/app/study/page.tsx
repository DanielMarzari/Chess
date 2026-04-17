'use client';

import Link from 'next/link';
import {
  BookOpen,
  Crosshair,
  Flag,
  Shapes,
  Sparkles,
} from 'lucide-react';

interface StudyCategory {
  id: string;
  title: string;
  icon: React.ElementType;
  description: string;
  items: string[];
  comingSoon?: boolean;
  href?: string;
}

const CATEGORIES: StudyCategory[] = [
  {
    id: 'tactics',
    title: 'Tactics',
    icon: Crosshair,
    description:
      'Drill the patterns — forks, pins, skewers, discovered attacks, x-rays, back-rank, removing the defender.',
    items: [
      'Fork motifs',
      'Pin & skewer',
      'Discovered attacks',
      'Back-rank weaknesses',
      'Deflection & decoy',
      'Zwischenzug',
    ],
    comingSoon: true,
  },
  {
    id: 'openings',
    title: 'Openings',
    icon: BookOpen,
    description:
      'Learn the ideas behind your favorite opening systems — core moves, typical middlegame plans, common traps.',
    items: [
      "Ruy López",
      "Italian Game",
      "Sicilian Defense",
      "French Defense",
      "Queen's Gambit",
      "King's Indian",
    ],
    comingSoon: true,
  },
  {
    id: 'endgames',
    title: 'Endgames',
    icon: Flag,
    description:
      'The games decided when the board is nearly empty. Technique drills with minimal material.',
    items: [
      'King & pawn endings',
      'Rook endings',
      'Bishop vs knight',
      'Opposition & triangulation',
      'Lucena & Philidor',
      'Pawn races',
    ],
    comingSoon: true,
  },
  {
    id: 'patterns',
    title: 'Patterns',
    icon: Shapes,
    description:
      'Positional motifs that repeat across thousands of games — weak squares, outposts, pawn structures, typical sacrifices.',
    items: [
      'Bishop sacrifices on h6/h7',
      'Greek gift',
      'Good vs bad bishop',
      'Isolated queen pawn',
      'Hanging pawns',
      'Fianchetto structures',
    ],
    comingSoon: true,
  },
];

export default function StudyPage() {
  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded bg-[var(--accent)]/10">
          <Sparkles size={22} className="text-[var(--accent)]" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Study</h1>
          <p className="text-sm text-[var(--muted)] mt-0.5">
            Learn the recurring ideas of chess — tactics, openings, endgames, and positional
            patterns. Build the vocabulary that shows up in every game.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <section
              key={cat.id}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4 space-y-3"
            >
              <div className="flex items-center gap-2">
                <Icon size={18} className="text-[var(--accent)]" />
                <h2 className="font-semibold text-[var(--foreground-strong)]">{cat.title}</h2>
                {cat.comingSoon && (
                  <span className="ml-auto text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-[var(--warning)]/20 text-[var(--warning)] border border-[var(--warning)]/40">
                    Coming soon
                  </span>
                )}
              </div>
              <p className="text-sm text-[var(--foreground)] leading-relaxed">{cat.description}</p>
              <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
                {cat.items.map((item) => (
                  <li key={item} className="flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-[var(--accent)]/60" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <div className="bg-[var(--surface)] border border-dashed border-[var(--border)] rounded-lg p-4 text-center">
        <p className="text-sm text-[var(--muted)]">
          Each category will include interactive position sets, spaced-repetition review, and
          progress tracking per motif. Meanwhile, hop over to{' '}
          <Link href="/train" className="text-[var(--accent)] hover:underline">
            Train
          </Link>{' '}
          for the existing puzzle trainer or{' '}
          <Link href="/analyze" className="text-[var(--accent)] hover:underline">
            Analyze
          </Link>{' '}
          to walk through the classics.
        </p>
      </div>
    </div>
  );
}
