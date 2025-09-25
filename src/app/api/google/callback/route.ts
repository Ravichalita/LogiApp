
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { adminDb } from '@/lib/firebase-admin';
import { syncAllOsToGoogleCalendarAction } from '@/lib/actions';

// This function now gets the user ID from the state parameter, not a session cookie.
async function getUserIdFromState(req: NextRequest): Promise<string | null> {
    const { searchParams } = new URL(req.url);
    return searchParams.get('state');
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin;
    const redirectUri = `${baseUrl}/api/google/callback`;


    if (!code) {
        return NextResponse.redirect(new URL('/settings?error=google_auth_failed&reason=no_code', baseUrl));
    }
    
    // It's crucial to get the user context BEFORE processing the code
    const userId = await getUserIdFromState(req);
    if (!userId) {
        // This can happen if the state parameter is lost or tampered with.
        return NextResponse.redirect(new URL('/login?error=invalid_state', baseUrl));
    }

    try {
        const oAuth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            redirectUri
        );

        const { tokens } = await oAuth2Client.getToken({ code, redirect_uri: redirectUri });
        
        const userRef = adminDb.doc(`users/${userId}`);
        const userSnap = await userRef.get();
        const existingData = userSnap.data()?.googleCalendar || {};

        const newGoogleCalendarData = {
            accessToken: tokens.access_token,
            expiryDate: tokens.expiry_date,
            refreshToken: tokens.refresh_token || existingData.refreshToken, // Preserve old refresh token if a new one isn't provided
            calendarId: existingData.calendarId || 'primary', // Preserve existing calendar ID or default to primary
        };

        // Atomically set the entire googleCalendar object
        await userRef.set({ googleCalendar: newGoogleCalendarData }, { merge: true });


        // After successfully saving tokens, trigger the initial sync of all existing OSs
        await syncAllOsToGoogleCalendarAction(userId);

        // Redirect back to settings page with a success message
        return NextResponse.redirect(new URL('/os?success=google_auth_complete', baseUrl));

    } catch (error: any) {
        console.error("Error during Google OAuth callback:", error);
        
        const googleErrorCode = error.response?.data?.error;
        const errorMessage = `google_error_${googleErrorCode || 'unknown'}`;

        // Redirect with a more specific error
        return NextResponse.redirect(new URL(`/settings?error=${errorMessage}`, baseUrl));
    }
}
