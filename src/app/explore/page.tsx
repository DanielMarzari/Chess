'use client';

import PlayView from '@/components/PlayView';

export default function ExplorePage() {
  return <PlayView allowedModes={['free', 'cpu']} tabLabel="Explore" />;
}
