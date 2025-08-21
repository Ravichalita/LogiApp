
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
} from 'firebase/firestore';
import { getFirebase } from './firebase';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ClientSchema, DumpsterSchema, RentalSchema, CompletedRentalSchema, UpdateClientSchema, UpdateDumpsterSchema, UpdateRentalSchema } from './types';
import type { Rental } from './types';

// Helper function for error handling
function handleFirebaseError(error: unknown) {
  if (error instanceof Error) {
    if ('code' in error) {
      // Firebase specific error
      console.error(`Firebase error (${(error as any).code}): ${error.message}`);
      return `Erro no servidor: ${(error as any).code}`;
    }
    console.error(`Generic error: ${error.message}`);
    return `Ocorreu um erro: ${error.message}`;
  }
  console.error(`Unknown error: ${error}`);
  return 'Ocorreu um erro desconhecido.';
}


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
    return { message: handleFirebaseError(e) };
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
         return { message: 'error', error: handleFirebaseError(e) };
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
        return { message: 'error', error: handleFirebaseError(e) };
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
        return { message: 'error', error: handleFirebaseError(e) };
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
    return { message: 'error', error: handleFirebaseError(e) };
  }
}
// #endregion
