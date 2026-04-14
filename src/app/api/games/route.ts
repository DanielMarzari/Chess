import { NextRequest, NextResponse } from 'next/server';
import { getAllGames, getGame, createGame, updateGame, deleteGame } from '@/lib/queries';

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (id) {
    const game = getGame(parseInt(id));
    if (!game) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(game);
  }
  return NextResponse.json(getAllGames());
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.pgn) {
      return NextResponse.json({ error: 'PGN is required' }, { status: 400 });
    }
    const game = createGame(body);
    return NextResponse.json(game, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to save game' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }
    updateGame(body.id, body);
    const game = getGame(body.id);
    return NextResponse.json(game);
  } catch {
    return NextResponse.json({ error: 'Failed to update game' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  deleteGame(parseInt(id));
  return NextResponse.json({ success: true });
}
