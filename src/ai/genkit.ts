import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {enableFirebaseTelemetry} from '@genkit-ai/firebase';

// A inicialização do Firebase Admin é gerenciada em firebase-admin.ts e não precisa ser chamada aqui.

export const ai = genkit({
  plugins: [
    googleAI(),
    ],
});
