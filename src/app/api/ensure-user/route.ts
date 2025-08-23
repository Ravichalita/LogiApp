
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { ensureUserDocument } from '@/lib/data-server';

export async function POST(req: Request) {
  // This endpoint is deprecated and should not be used.
  // The logic is now handled by the server-side signupAction.
  // We keep it to avoid breaking older client versions if they exist,
  // but it will simply return an error.
  return NextResponse.json({ error: 'This endpoint is deprecated.' }, { status: 410 });
}

    