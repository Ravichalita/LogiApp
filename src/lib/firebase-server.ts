
'use server';
import * as admin from 'firebase-admin';

// Esta função inicializa o Firebase Admin SDK e destina-se ao uso em código do lado do servidor.
export async function getFirebaseAdmin() {
    if (admin.apps.length > 0) {
        const app = admin.app();
        const db = admin.firestore(app);
        const auth = admin.auth(app);
        return { app, db, auth };
    }

    // A chave da conta de serviço é esperada como uma string codificada em Base64.
    const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

    if (!serviceAccountBase64) {
        throw new Error('A variável de ambiente FIREBASE_SERVICE_ACCOUNT_BASE64 não está definida. Isso é necessário para operações do lado do servidor do Firebase Admin.');
    }

    try {
        // Decodifique a string Base64 para obter o JSON da conta de serviço.
        const decodedServiceAccount = Buffer.from(serviceAccountBase64, 'base64').toString('utf8');
        const serviceAccount = JSON.parse(decodedServiceAccount);
            
        const app = admin.initializeApp({
             credential: admin.credential.cert(serviceAccount),
        });

        const db = admin.firestore(app);
        const auth = admin.auth(app);

        return { app, db, auth };
    } catch (e) {
        console.error("Falha ao inicializar o Firebase Admin:", e);
        if (e instanceof Error) {
             throw new Error(`Não foi possível inicializar o Firebase Admin: ${e.message}`);
        }
        throw new Error("Ocorreu um erro desconhecido durante a inicialização do Firebase Admin.");
    }
}
