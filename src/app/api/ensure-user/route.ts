
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { ensureUserDocument } from '@/lib/data-server';

export async function POST(req: Request) {
  try {
    const auth = req.headers.get('authorization') || '';
    if (!auth.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'missing token' }, { status: 401 });
    }
    const token = auth.slice(7);
    const decoded = await adminAuth.verifyIdToken(token, true);
    const user = await adminAuth.getUser(decoded.uid);
    const accountId = await ensureUserDocument(user);
    return NextResponse.json({ ok: true, accountId });
  } catch (error) {
    console.error('[ensure-user API] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to ensure user document', details: message }, { status: 500 });
  }
}
