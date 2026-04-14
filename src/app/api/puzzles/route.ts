import { NextRequest, NextResponse } from 'next/server';
import { getRandomPuzzle, getPuzzle, createPuzzle, recordPuzzleAttempt, getPuzzleStats } from '@/lib/queries';

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  const stats = request.nextUrl.searchParams.get('stats');

  if (stats) {
    return NextResponse.json(getPuzzleStats());
  }

  if (id) {
    const puzzle = getPuzzle(parseInt(id));
    if (!puzzle) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(puzzle);
  }

  const puzzle = getRandomPuzzle();
  if (!puzzle) return NextResponse.json({ error: 'No puzzles available' }, { status: 404 });
  return NextResponse.json(puzzle);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Record an attempt
    if (body.puzzleId !== undefined) {
      recordPuzzleAttempt(body.puzzleId, body.solved, body.timeSeconds);
      return NextResponse.json({ success: true });
    }

    // Create a puzzle
    if (!body.fen || !body.solution) {
      return NextResponse.json({ error: 'fen and solution are required' }, { status: 400 });
    }
    const puzzle = createPuzzle(body);
    return NextResponse.json(puzzle, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
