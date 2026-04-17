'use client';

import PlayView from '@/components/PlayView';

export default function MentorPage() {
  return <PlayView allowedModes={['coach']} tabLabel="Mentor" adaptiveElo />;
}
