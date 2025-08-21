
'use server';

import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { adminAuth } from './firebase-admin';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ClientSchema, DumpsterSchema, RentalSchema, CompletedRentalSchema, UpdateClientSchema, UpdateDumpsterSchema, UpdateRentalSchema, SignupSchema } from './types';
import type { Rental } from './types';
import { ensureUserDocument } from './data-server';

const firestore = getFirestore();

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
      const fieldErrors = validatedFields.error.flatten().fieldErrors;
      // Return the first error found in any field
      const firstError = Object.values(fieldErrors).flat()[0] || 'Por favor, verifique os campos.';
      if (fieldErrors._errors && fieldErrors._errors.length > 0) {
        return { message: fieldErrors._errors[0] };
      }
      return { message: firstError };
  }

  const { email, password } = validatedFields.data;

  try {
      // 1. Create user in Firebase Auth
      const userRecord = await adminAuth.createUser({
          email,
          password,
          emailVerified: false, // Start with email unverified
      });

      // 2. Ensure Firestore documents are created and synced
      await ensureUserDocument(userRecord);

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

  try {
    const clientsCollection = firestore.collection(`accounts/${accountId}/clients`);
    await clientsCollection.add({
      ...validatedFields.data,
      createdAt: FieldValue.serverTimestamp(),
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

    try {
        const clientDoc = firestore.doc(`accounts/${accountId}/clients/${id}`);
        await clientDoc.update({
          ...clientData,
          updatedAt: FieldValue.serverTimestamp(),
        });
        revalidatePath('/clients');
        return { message: 'success' };
    } catch (e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }
}


export async function deleteClientAction(accountId: string, clientId: string) {
  try {
    // Optional: Check for associated rentals before deleting
    await firestore.doc(`accounts/${accountId}/clients/${clientId}`).delete();
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

  try {
    const dumpstersCollection = firestore.collection(`accounts/${accountId}/dumpsters`);
    await dumpstersCollection.add({
      ...validatedFields.data,
      createdAt: FieldValue.serverTimestamp(),
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

  try {
    const dumpsterDoc = firestore.doc(`accounts/${accountId}/dumpsters/${id}`);
    await dumpsterDoc.update({
      ...dumpsterData,
      updatedAt: FieldValue.serverTimestamp(),
    });
    revalidatePath('/dumpsters');
    revalidatePath('/'); // Also revalidate home page as dumpster status might affect rentals
    return { message: 'success' };
  } catch (e) {
    return { message: 'error', error: handleFirebaseError(e) };
  }
}

export async function deleteDumpsterAction(accountId: string, dumpsterId: string) {
  try {
    await firestore.doc(`accounts/${accountId}/dumpsters/${dumpsterId}`).delete();
    revalidatePath('/dumpsters');
    revalidatePath('/');
    return { message: 'success' };
  } catch (e) {
    return { message: 'error', error: handleFirebaseError(e) };
  }
}

export async function updateDumpsterStatusAction(accountId: string, dumpsterId: string, newStatus: 'Disponível' | 'Em Manutenção') {
    try {
        const dumpsterRef = firestore.doc(`accounts/${accountId}/dumpsters/${dumpsterId}`);
        await dumpsterRef.update({ status: newStatus });
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

  try {
    const rentalData = validatedFields.data;
    
    await firestore.collection(`accounts/${accountId}/rentals`).add({
      ...rentalData,
      createdAt: FieldValue.serverTimestamp(),
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
    
    const batch = firestore.batch();
    
    try {
        const rentalRef = firestore.doc(`accounts/${accountId}/rentals/${rentalId}`);
        const rentalSnap = await rentalRef.get();
        
        if (!rentalSnap.exists()) {
            throw new Error('Aluguel não encontrado.');
        }
        
        const rentalData = rentalSnap.data() as Rental;

        const rentalDate = new Date(rentalData.rentalDate);
        const returnDate = new Date(rentalData.returnDate);
        const diffTime = Math.abs(returnDate.getTime() - rentalDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const rentalDays = Math.max(diffDays, 1);
        const totalValue = rentalDays * rentalData.value;
        
        const completedRentalData = {
            ...rentalData,
            originalRentalId: rentalId,
            completedDate: FieldValue.serverTimestamp(),
            rentalDays,
            totalValue
        };

        const validatedFields = CompletedRentalSchema.safeParse(completedRentalData);

        if (!validatedFields.success) {
            console.error("Validation failed for completed rental:", validatedFields.error.flatten().fieldErrors);
            throw new Error("Dados inválidos para finalizar o aluguel.");
        }

        // Add to completed_rentals
        const newCompletedRentalRef = firestore.collection(`accounts/${accountId}/completed_rentals`).doc();
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
    try {
        await firestore.doc(`accounts/${accountId}/rentals/${rentalId}`).delete();
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

    try {
        const rentalDoc = firestore.doc(`accounts/${accountId}/rentals/${id}`);
        await rentalDoc.update({
          ...rentalData,
          updatedAt: FieldValue.serverTimestamp(),
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
  try {
    const completedRentalsRef = firestore.collection(`accounts/${accountId}/completed_rentals`);
    const q = completedRentalsRef.select(); // query() is client-side, just select() is enough here
    const querySnapshot = await q.get();

    const batch = firestore.batch();
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

    