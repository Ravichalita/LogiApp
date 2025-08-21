
'use server';

import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  where,
  getDocs,
  writeBatch,
  setDoc,
} from 'firebase/firestore';
import { getFirebase } from './firebase';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ClientSchema, DumpsterSchema, RentalSchema, CompletedRentalSchema, UpdateClientSchema, UpdateDumpsterSchema, UpdateRentalSchema, SignupSchema } from './types';
import type { Rental } from './types';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirebaseAdmin } from './firebase-server';


// Helper function for error handling
function handleFirebaseError(error: unknown): string {
  let message = 'Ocorreu um erro desconhecido.';
  if (error instanceof Error) {
    message = error.message;
    if ('code' in error) {
      switch ((error as any).code) {
        case 'auth/email-already-exists':
          return 'Este e-mail já está em uso por outra conta.';
        case 'auth/invalid-email':
          return 'O formato do e-mail é inválido.';
        case 'auth/weak-password':
          return 'A senha é muito fraca. Use pelo menos 6 caracteres.';
        default:
          return `Erro no servidor: ${(error as any).code}`;
      }
    }
  }
  return message;
}

// #region Auth Actions

export async function signupAction(prevState: any, formData: FormData) {
  const validatedFields = SignupSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!validatedFields.success) {
      return { message: validatedFields.error.flatten().fieldErrors._errors[0] };
  }

  const { email, password } = validatedFields.data;
  const { app, db } = await getFirebaseAdmin();
  const adminAuth = getAdminAuth(app);

  try {
      // 1. Create user in Firebase Auth
      const userRecord = await adminAuth.createUser({
          email,
          password,
          emailVerified: false, // Start with email unverified
      });

      // 2. Create documents in Firestore
      const batch = writeBatch(db);

      // 2a. Create account document
      const accountRef = doc(collection(db, "accounts"));
      batch.set(accountRef, {
          ownerId: userRecord.uid,
          name: `${email}'s Account`,
          createdAt: serverTimestamp(),
      });

      // 2b. Create user document
      const userRef = doc(db, "users", userRecord.uid);
      batch.set(userRef, {
          email: userRecord.email,
          accountId: accountRef.id,
          role: "admin",
      });
      
      // 3. Commit batch
      await batch.commit();

      // 4. Send verification email
      // We are creating a custom link to avoid issues with default Firebase links in some environments
      const verificationLink = await adminAuth.generateEmailVerificationLink(email);
      // Here you would typically send an email with this link using a service like SendGrid, Resend, etc.
      // For this app, we'll rely on the client-side to prompt the user to check their email and the built-in Firebase console sender.
      // console.log("Verification link:", verificationLink); // For debugging

      return { message: 'success' };
  } catch (e) {
      return { message: handleFirebaseError(e) };
  }
}


// #endregion


// #region Client Actions
export async function createClient(accountId: string, prevState: any, formData: FormData) {
  const validatedFields = ClientSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'error',
    };
  }

  const { db } = getFirebase();
  try {
    const clientsCollection = collection(db, `accounts/${accountId}/clients`);
    await addDoc(clientsCollection, {
      ...validatedFields.data,
      createdAt: serverTimestamp(),
    });
    revalidatePath('/clients');
    return { message: 'success' };
  } catch (e) {
    return { message: 'error', error: handleFirebaseError(e) };
  }
}

export async function updateClient(accountId: string, prevState: any, formData: FormData) {
    const validatedFields = UpdateClientSchema.safeParse(Object.fromEntries(formData.entries()));

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'error',
        };
    }
    
    const { id, ...clientData } = validatedFields.data;

    const { db } = getFirebase();
    try {
        const clientDoc = doc(db, `accounts/${accountId}/clients`, id);
        await updateDoc(clientDoc, {
          ...clientData,
          updatedAt: serverTimestamp(),
        });
        revalidatePath('/clients');
        return { message: 'success' };
    } catch (e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }
}


export async function deleteClientAction(accountId: string, clientId: string) {
  const { db } = getFirebase();
  try {
    // Optional: Check for associated rentals before deleting
    await deleteDoc(doc(db, `accounts/${accountId}/clients`, clientId));
    revalidatePath('/clients');
    return { message: 'success' };
  } catch (e) {
    return { message: 'error', error: handleFirebaseError(e) };
  }
}
// #endregion


// #region Dumpster Actions

export async function createDumpster(accountId: string, prevState: any, formData: FormData) {
  const validatedFields = DumpsterSchema.safeParse({
      ...Object.fromEntries(formData.entries()),
      size: Number(formData.get('size')),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'error',
    };
  }

  const { db } = getFirebase();
  try {
    const dumpstersCollection = collection(db, `accounts/${accountId}/dumpsters`);
    await addDoc(dumpstersCollection, {
      ...validatedFields.data,
      createdAt: serverTimestamp(),
    });
    revalidatePath('/dumpsters');
    return { message: 'success' };
  } catch (e) {
    return { message: 'error', error: handleFirebaseError(e) };
  }
}

export async function updateDumpster(accountId: string, prevState: any, formData: FormData) {
  const validatedFields = UpdateDumpsterSchema.safeParse({
     ...Object.fromEntries(formData.entries()),
      size: Number(formData.get('size')),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'error',
    };
  }

  const { id, ...dumpsterData } = validatedFields.data;

  const { db } = getFirebase();
  try {
    const dumpsterDoc = doc(db, `accounts/${accountId}/dumpsters`, id);
    await updateDoc(dumpsterDoc, {
      ...dumpsterData,
      updatedAt: serverTimestamp(),
    });
    revalidatePath('/dumpsters');
    revalidatePath('/'); // Also revalidate home page as dumpster status might affect rentals
    return { message: 'success' };
  } catch (e) {
    return { message: 'error', error: handleFirebaseError(e) };
  }
}

export async function deleteDumpsterAction(accountId: string, dumpsterId: string) {
  const { db } = getFirebase();
  try {
    await deleteDoc(doc(db, `accounts/${accountId}/dumpsters`, dumpsterId));
    revalidatePath('/dumpsters');
    revalidatePath('/');
    return { message: 'success' };
  } catch (e) {
    return { message: 'error', error: handleFirebaseError(e) };
  }
}

export async function updateDumpsterStatusAction(accountId: string, dumpsterId: string, newStatus: 'Disponível' | 'Em Manutenção') {
    const { db } = getFirebase();
    try {
        const dumpsterRef = doc(db, `accounts/${accountId}/dumpsters`, dumpsterId);
        await updateDoc(dumpsterRef, { status: newStatus });
        revalidatePath('/dumpsters');
        revalidatePath('/');
        return { message: 'success' };
    } catch(e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }
}


// #endregion

// #region Rental Actions

export async function createRental(accountId: string, createdBy: string, prevState: any, formData: FormData) {
  const rawData = Object.fromEntries(formData.entries());
  
  const rawValue = rawData.value as string;
  const numericValue = parseFloat(rawValue.replace('R$', '').replace(/\./g, '').replace(',', '.').trim());

  const validatedFields = RentalSchema.safeParse({
    ...rawData,
    value: numericValue,
    latitude: rawData.latitude ? parseFloat(rawData.latitude as string) : undefined,
    longitude: rawData.longitude ? parseFloat(rawData.longitude as string) : undefined,
    status: 'Pendente',
    createdBy: createdBy,
  });

  if (!validatedFields.success) {
    console.log(validatedFields.error.flatten().fieldErrors);
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'error',
    };
  }

  const { db } = getFirebase();
  try {
    const rentalData = validatedFields.data;
    const newRentalRef = doc(collection(db, `accounts/${accountId}/rentals`));
    
    await addDoc(collection(db, `accounts/${accountId}/rentals`), {
      ...rentalData,
      createdAt: serverTimestamp(),
    });

  } catch (e) {
    return { message: handleFirebaseError(e) as string };
  }

  revalidatePath('/');
  redirect('/');
}

export async function finishRentalAction(accountId: string, formData: FormData) {
    const rentalId = formData.get('rentalId') as string;

    if (!rentalId) {
        return { message: 'error', error: 'Rental ID is missing.' };
    }
    
    const { db } = getFirebase();
    const batch = writeBatch(db);
    
    try {
        const rentalRef = doc(db, `accounts/${accountId}/rentals`, rentalId);
        const rentalSnap = await getDocs(query(collection(db, `accounts/${accountId}/rentals`), where('__name__', '==', rentalId)));
        
        if (rentalSnap.empty) {
            throw new Error('Aluguel não encontrado.');
        }
        
        const rentalData = rentalSnap.docs[0].data() as Rental;

        const rentalDate = new Date(rentalData.rentalDate);
        const returnDate = new Date(rentalData.returnDate);
        const diffTime = Math.abs(returnDate.getTime() - rentalDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const rentalDays = Math.max(diffDays, 1);
        const totalValue = rentalDays * rentalData.value;
        
        const completedRentalData = {
            ...rentalData,
            originalRentalId: rentalId,
            completedDate: serverTimestamp(),
            rentalDays,
            totalValue
        };

        const validatedFields = CompletedRentalSchema.safeParse(completedRentalData);

        if (!validatedFields.success) {
            console.error("Validation failed for completed rental:", validatedFields.error.flatten().fieldErrors);
            throw new Error("Dados inválidos para finalizar o aluguel.");
        }

        // Add to completed_rentals
        const newCompletedRentalRef = doc(collection(db, `accounts/${accountId}/completed_rentals`));
        batch.set(newCompletedRentalRef, validatedFields.data);

        // Delete from active rentals
        batch.delete(rentalRef);
        
        await batch.commit();

        revalidatePath('/');
        revalidatePath('/stats');
        
    } catch(e) {
         console.error("Failed to finish rental:", e);
         return { message: 'error', error: handleFirebaseError(e) as string };
    }

    redirect('/');
}

export async function cancelRentalAction(accountId: string, rentalId: string) {
    if (!rentalId) {
        return { message: 'error', error: 'Rental ID is missing.' };
    }
    const { db } = getFirebase();
    try {
        await deleteDoc(doc(db, `accounts/${accountId}/rentals`, rentalId));
        revalidatePath('/');
        return { message: 'success' };
    } catch (e) {
        return { message: 'error', error: handleFirebaseError(e) as string };
    }
}

export async function updateRentalAction(accountId: string, prevState: any, formData: FormData) {
    const validatedFields = UpdateRentalSchema.safeParse(Object.fromEntries(formData.entries()));

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'error',
        };
    }
    
    const { id, ...rentalData } = validatedFields.data;

    const { db } = getFirebase();
    try {
        const rentalDoc = doc(db, `accounts/${accountId}/rentals`, id);
        await updateDoc(rentalDoc, {
          ...rentalData,
          updatedAt: serverTimestamp(),
        });
        revalidatePath('/');
        return { message: 'success' };
    } catch (e) {
        return { message: 'error', error: handleFirebaseError(e) as string };
    }
}


// #endregion

// #region Stats Actions
export async function resetBillingDataAction(accountId: string) {
  const { db } = getFirebase();
  try {
    const completedRentalsRef = collection(db, `accounts/${accountId}/completed_rentals`);
    const q = query(completedRentalsRef);
    const querySnapshot = await getDocs(q);

    const batch = writeBatch(db);
    querySnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    revalidatePath('/stats');
    return { message: 'success' };
  } catch (e) {
    return { message: 'error', error: handleFirebaseError(e) as string };
  }
}
// #endregion
