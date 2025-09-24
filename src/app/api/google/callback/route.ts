
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { syncAllOsToGoogleCalendarAction } from '@/lib/actions';

// Helper function to get the user ID from the session cookie
async function getUserIdFromSession(req: NextRequest): Promise<string | null> {
    const sessionCookie = req.cookies.get('__session')?.value;
    if (!sessionCookie) {
        console.log("No session cookie found");
        return null;
    }

    try {
        const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
        return decodedToken.uid;
    } catch (error) {
        console.error("Error verifying session cookie:", error);
        return null;
    }
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
    const userId = await getUserIdFromSession(req);
    if (!userId) {
        // This can happen if the session expires during the OAuth flow.
        return NextResponse.redirect(new URL('/login?error=session_expired', baseUrl));
    }

    try {
        const oAuth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            redirectUri
        );

        const { tokens } = await oAuth2Client.getToken({ code, redirect_uri: redirectUri });
        
        const userRef = adminDb.doc(`users/${userId}`);

        const updateData: { [key: string]: any } = {
            'googleCalendar.accessToken': tokens.access_token,
            'googleCalendar.expiryDate': tokens.expiry_date,
            'googleCalendar.calendarId': 'primary', // Default to primary calendar
        };

        if (tokens.refresh_token) {
            updateData['googleCalendar.refreshToken'] = tokens.refresh_token;
        }

        await userRef.update(updateData);


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
