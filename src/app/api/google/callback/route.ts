
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
    const state = searchParams.get('state');

    if (!code) {
        return NextResponse.redirect(new URL('/settings?error=google_auth_failed', req.url));
    }

    try {
        const userId = await getUserIdFromSession(req);
        if (!userId) {
            throw new Error("Usuário não autenticado. Por favor, faça login novamente.");
        }
        
        const oAuth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        const { tokens } = await oAuth2Client.getToken(code);
        
        if (!tokens.refresh_token) {
            console.warn("Refresh token não recebido. O usuário pode precisar re-autenticar no futuro.");
        }
        
        oAuth2Client.setCredentials(tokens);

        const userRef = adminDb.doc(`users/${userId}`);

        await userRef.update({
            'googleCalendar.accessToken': tokens.access_token,
            'googleCalendar.refreshToken': tokens.refresh_token,
            'googleCalendar.expiryDate': tokens.expiry_date,
            'googleCalendar.calendarId': 'primary', // Default to primary calendar
        });

        // After successfully saving tokens, trigger the initial sync
        await syncAllOsToGoogleCalendarAction(userId);

        return NextResponse.redirect(new URL('/settings?success=google_auth_complete', req.url));

    } catch (error) {
        console.error("Error during Google OAuth callback:", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent(errorMessage)}`, req.url));
    }
}
