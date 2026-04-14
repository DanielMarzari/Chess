import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

const validSessions = new Set<string>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const providedPassword = body.password;
    const authPassword = process.env.AUTH_PASSWORD;

    if (!authPassword) {
      return NextResponse.json({ error: 'Auth not configured' }, { status: 500 });
    }

    if (providedPassword !== authPassword) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    const sessionToken = randomUUID();
    validSessions.add(sessionToken);

    const response = NextResponse.json({ success: true });
    response.cookies.set('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Auth failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get('session_token')?.value;
  if (!sessionToken || !validSessions.has(sessionToken)) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true });
}
