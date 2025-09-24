
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { adminDb } from '@/lib/firebase-admin';
import { getFirebaseIdToken } from '@/lib/firebase-client'; // This will be tricky, need a server-side way

async function getUserIdFromSession(req: NextRequest): Promise<string | null> {
    const session = req.cookies.get('__session');
    if (!session) return null;

    try {
        // Here you would typically use firebase-admin to verify the session cookie
        // For this example, let's assume we have a way to get the UID.
        // This part needs a proper implementation based on your auth flow.
        // For now, let's mock it.
        // const decodedToken = await adminAuth.verifySessionCookie(session.value, true);
        // return decodedToken.uid;
        return null; // Placeholder
    } catch (error) {
        console.error("Error verifying session cookie:", error);
        return null;
    }
}


export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // You should use state for security

    if (!code) {
        return NextResponse.redirect(new URL('/settings?error=google_auth_failed', req.url));
    }

    try {
        const oAuth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);

        // You need to associate these tokens with the currently logged-in Firebase user
        // This is a simplified example. In a real app, you'd get the user's ID
        // from their session (e.g., via a session cookie).
        const userId = 'REPLACE_WITH_LOGGED_IN_USER_ID'; // THIS IS THE CRITICAL PART TO FIGURE OUT

        if (!userId) {
             throw new Error("User not authenticated.");
        }
        
        const userRef = adminDb.doc(`users/${userId}`);

        await userRef.update({
            'googleCalendar.accessToken': tokens.access_token,
            'googleCalendar.refreshToken': tokens.refresh_token,
            'googleCalendar.expiryDate': tokens.expiry_date,
            'googleCalendar.calendarId': 'primary', // Default to primary calendar
        });

        return NextResponse.redirect(new URL('/settings?success=google_auth_complete', req.url));

    } catch (error) {
        console.error("Error during Google OAuth callback:", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent(errorMessage)}`, req.url));
    }
}
