import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {firebase} from '@genkit-ai/firebase';
import { getFirebase } from '@/lib/firebase-client';

// Ensure Firebase is initialized before Genkit uses it
getFirebase();

export const ai = genkit({
  plugins: [
    googleAI(),
    firebase(),
    ],
  model: 'googleai/gemini-2.0-flash',
});
