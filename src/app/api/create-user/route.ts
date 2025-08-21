
// This API route has been deprecated and is no longer in use.
// The logic for creating user and account documents has been migrated to
// a Firebase Function trigger (functions/src/index.ts). This is a more robust
// and reliable approach for handling post-authentication actions.
// This file can be safely deleted.
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  return NextResponse.json(
    { error: 'This endpoint is deprecated.' },
    { status: 410 }
  );
}
