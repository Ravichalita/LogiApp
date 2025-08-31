

'use server';

import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminAuth, adminDb, adminApp } from './firebase-admin';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ClientSchema, DumpsterSchema, RentalSchema, CompletedRentalSchema, UpdateClientSchema, UpdateDumpsterSchema, UpdateRentalSchema, SignupSchema, UserAccountSchema, PermissionsSchema, RentalPricesSchema, RentalPrice, UpdateBackupSettingsSchema, UpdateUserProfileSchema, Rental, RentalPriceSchema } from './types';
import type { UserAccount, UserRole, UserStatus, Permissions, Account } from './types';
import { ensureUserDocument } from './data-server';
import { cookies } from 'next/cookies';
import { sendNotification } from './notifications';
import { addDays, isBefore, isAfter, isToday, parseISO, startOfToday, format, set } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

// Helper function for error handling
function handleFirebaseError(error: unknown): string {
  let message = 'Ocorreu um erro desconhecido.';
  if (error instanceof Error) {
    message = error.message;
    if ('code' in error) {
      switch ((error as any).code) {
        case 'auth/email-already-exists':
        case 'auth/email-already-in-use':
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

export async function signupAction(inviterAccountId: string | null, prevState: any, formData: FormData) {
  const isInvite = !!inviterAccountId;
  
  const validatedFields = SignupSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!validatedFields.success) {
      const fieldErrors = validatedFields.error.flatten().fieldErrors;
      if (fieldErrors._errors && fieldErrors._errors.length > 0) {
        return { ...prevState, message: fieldErrors._errors[0] };
      }
      const firstError = Object.values(fieldErrors).flat()[0] || 'Por favor, verifique os campos.';
      return { ...prevState, message: firstError };
  }

  const { name, email, password } = validatedFields.data;
  
  try {
      await ensureUserDocument({ name, email, password }, inviterAccountId);
      
      const successState = {
        ...prevState,
        message: 'success',
        newUser: {
          name,
          email,
          password: password,
        },
      };
      
      return successState;

  } catch (e) {
      return { ...prevState, message: handleFirebaseError(e) };
  }
}

export async function updateUserRoleAction(accountId: string, userId: string, newRole: UserRole) {
    try {
        const db = getFirestore(adminApp);
        const userRef = db.doc(`users/${userId}`);
        const userSnap = await userRef.get();
        if (!userSnap.exists || userSnap.data()?.accountId !== accountId) {
             throw new Error("Usuário não encontrado ou não pertence a esta conta.");
        }
        await adminAuth.setCustomUserClaims(userId, { role: newRole, accountId });
        await userRef.update({ role: newRole });
        revalidatePath('/team');
        return { message: 'success' };
    } catch(e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }
}

export async function updateUserPermissionsAction(accountId: string, userId: string, permissions: Permissions) {
    try {
        const db = getFirestore(adminApp);
        const userRef = db.doc(`users/${userId}`);
        const userSnap = await userRef.get();
        if (!userSnap.exists || userSnap.data()?.accountId !== accountId) {
             throw new Error("Usuário não encontrado ou não pertence a esta conta.");
        }

        const validatedPermissions = PermissionsSchema.parse(permissions);

        await userRef.update({ permissions: validatedPermissions });
        revalidatePath('/team');
        revalidatePath('/notifications-studio');
        return { message: 'success' };
    } catch(e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }
}

export async function removeTeamMemberAction(accountId: string, userId: string) {
    const db = getFirestore(adminApp);
    const batch = db.batch();
    try {
        // 1. Validate user
        const userRef = db.doc(`users/${userId}`);
        const userSnap = await userRef.get();
        if (!userSnap.exists || userSnap.data()?.accountId !== accountId) {
             throw new Error("Usuário não encontrado ou não pertence a esta conta.");
        }

        // 2. Find account owner
        const accountRef = db.doc(`accounts/${accountId}`);
        const accountSnap = await accountRef.get();
        const ownerId = accountSnap.data()?.ownerId;
        if (!ownerId) {
            throw new Error("Não foi possível encontrar o proprietário da conta para reatribuir os aluguéis.");
        }
        
        // 3. Find and reassign active rentals
        const rentalsRef = db.collection(`accounts/${accountId}/rentals`);
        const rentalsQuery = rentalsRef.where('assignedTo', '==', userId);
        const rentalsSnap = await rentalsQuery.get();
        
        if (!rentalsSnap.empty) {
            rentalsSnap.forEach(doc => {
                batch.update(doc.ref, { assignedTo: ownerId });
            });
        }

        // 4. Remove user from account members list
        batch.update(accountRef, {
            members: FieldValue.arrayRemove(userId)
        });

        // 5. Delete the user document itself
        batch.delete(userRef);
        
        await batch.commit();
        
        // 6. Delete the auth user (separate from transaction)
        await adminAuth.deleteUser(userId);

        revalidatePath('/team');
        revalidatePath('/'); // To update rentals list if any were reassigned
        return { message: 'success' };
    } catch (e) {
        return { message: 'error', error: handleFirebaseError(e) };
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
    const clientsCollection = getFirestore(adminApp).collection(`accounts/${accountId}/clients`);
    await clientsCollection.add({
      ...validatedFields.data,
      accountId,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    return { message: 'error', error: handleFirebaseError(e) };
  }

  revalidatePath('/clients');
  redirect('/clients');
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
        const clientDoc = getFirestore(adminApp).doc(`accounts/${accountId}/clients/${id}`);
        await clientDoc.update({
          ...clientData,
          updatedAt: FieldValue.serverTimestamp(),
        });
        revalidatePath('/clients');
    } catch (e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }

    redirect('/clients');
}


export async function deleteClientAction(accountId: string, clientId: string) {
  const db = getFirestore(adminApp);
  const batch = db.batch();

  try {
    // Find and delete all rentals associated with this client
    const rentalsRef = db.collection(`accounts/${accountId}/rentals`);
    const rentalsQuery = rentalsRef.where('clientId', '==', clientId);
    const rentalsSnap = await rentalsQuery.get();

    if (!rentalsSnap.empty) {
      rentalsSnap.forEach(doc => {
        batch.delete(doc.ref);
      });
    }

    // Delete the client document
    const clientRef = db.doc(`accounts/${accountId}/clients/${clientId}`);
    batch.delete(clientRef);
    
    await batch.commit();

    revalidatePath('/clients');
    revalidatePath('/'); // Also revalidate home page as rentals are deleted
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
    const dumpstersCollection = getFirestore(adminApp).collection(`accounts/${accountId}/dumpsters`);
    await dumpstersCollection.add({
      ...validatedFields.data,
      accountId,
      createdAt: FieldValue.serverTimestamp(),
    });
    revalidatePath('/dumpsters');
    return { message: 'success' };
  } catch (e) {
    return { message: 'error', error: handleFirebaseError(e) };
  }
}

export async function updateUserProfileAction(userId: string, prevState: any, formData: FormData) {
    const validatedFields = UpdateUserProfileSchema.safeParse(Object.fromEntries(formData.entries()));

    if (!validatedFields.success) {
        return { message: 'error', error: JSON.stringify(validatedFields.error.flatten().fieldErrors) };
    }

    try {
        const userRef = getFirestore(adminApp).doc(`users/${userId}`);
        await userRef.update({
            ...validatedFields.data,
            updatedAt: FieldValue.serverTimestamp(),
        });
        
        if (validatedFields.data.name) {
            await adminAuth.updateUser(userId, { displayName: validatedFields.data.name });
        }

        revalidatePath('/account');
        return { message: 'success' };
    } catch (e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }
}

export async function deleteSelfUserAction(accountId: string, userId: string) {
    if (!accountId || !userId) {
        return { message: 'error', error: "Informações do usuário ausentes." };
    }
    const db = getFirestore(adminApp);
    const batch = db.batch();
    try {
        const userRef = db.doc(`users/${userId}`);
        const userSnap = await userRef.get();
        if (!userSnap.exists || userSnap.data()?.accountId !== accountId) {
             throw new Error("Usuário não encontrado ou não pertence a esta conta.");
        }
        
        // Disassociate user from rentals instead of deleting them, to preserve history
        const rentalsRef = db.collection(`accounts/${accountId}/rentals`);
        const assignedRentalsQuery = rentalsRef.where('assignedTo', '==', userId);
        const assignedRentalsSnap = await assignedRentalsQuery.get();
        if (!assignedRentalsSnap.empty) {
            assignedRentalsSnap.forEach(doc => {
                batch.update(doc.ref, { assignedTo: FieldValue.delete() });
            });
        }
        
        const createdRentalsQuery = rentalsRef.where('createdBy', '==', userId);
        const createdRentalsSnap = await createdRentalsQuery.get();
        if (!createdRentalsSnap.empty) {
            createdRentalsSnap.forEach(doc => {
                batch.update(doc.ref, { createdBy: FieldValue.delete() });
            });
        }

        const accountRef = db.doc(`accounts/${accountId}`);
        batch.update(accountRef, {
            members: FieldValue.arrayRemove(userId)
        });

        batch.delete(userRef);
        await batch.commit();
        
        await adminAuth.deleteUser(userId);

        // No revalidation needed, user will be logged out.
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
    const dumpsterDoc = getFirestore(adminApp).doc(`accounts/${accountId}/dumpsters/${id}`);
    await dumpsterDoc.update({
      ...dumpsterData,
      accountId,
      updatedAt: FieldValue.serverTimestamp(),
    });
    revalidatePath('/dumpsters');
    revalidatePath('/');
    return { message: 'success' };
  } catch (e) {
    return { message: 'error', error: handleFirebaseError(e) };
  }
}

export async function deleteDumpsterAction(accountId: string, dumpsterId: string) {
  try {
    await getFirestore(adminApp).doc(`accounts/${accountId}/dumpsters/${dumpsterId}`).delete();
    revalidatePath('/dumpsters');
    revalidatePath('/');
    return { message: 'success' };
  } catch (e) {
    return { message: 'error', error: handleFirebaseError(e) };
  }
}

export async function updateDumpsterStatusAction(accountId: string, dumpsterId: string, newStatus: 'Disponível' | 'Em Manutenção') {
    try {
        const dumpsterRef = getFirestore(adminApp).doc(`accounts/${accountId}/dumpsters/${dumpsterId}`);
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
  const db = getFirestore(adminApp);
  const accountRef = db.doc(`accounts/${accountId}`);
  
  try {
    const newSequentialId = await db.runTransaction(async (transaction) => {
        const accountSnap = await transaction.get(accountRef);
        if (!accountSnap.exists) {
            throw new Error("Conta não encontrada.");
        }
        const currentCounter = accountSnap.data()?.rentalCounter || 0;
        const newCounter = currentCounter + 1;
        transaction.update(accountRef, { rentalCounter: newCounter });
        return newCounter;
    });

    const rawData = Object.fromEntries(formData.entries());
    const rawValue = rawData.value as string;
    const numericValue = parseFloat(rawValue.replace('R$', '').replace(/\./g, '').replace(',', '.').trim());

    const validatedFields = RentalSchema.safeParse({
        ...rawData,
        sequentialId: newSequentialId,
        value: numericValue,
        status: 'Pendente',
        createdBy: createdBy,
        notificationsSent: { due: false, late: false }
    });
    
    if (!validatedFields.success) {
      console.log(validatedFields.error.flatten().fieldErrors);
      return {
        errors: validatedFields.error.flatten().fieldErrors,
        message: 'error',
      };
    }

    const rentalData = validatedFields.data;

    const rentalsRef = db.collection(`accounts/${accountId}/rentals`);
    const q = rentalsRef.where('dumpsterId', '==', rentalData.dumpsterId);
    const existingRentalsSnap = await q.get();

    const newRentalStart = new Date(rentalData.rentalDate);
    const newRentalEnd = new Date(rentalData.returnDate);

    for (const doc of existingRentalsSnap.docs) {
        const existingRental = doc.data() as Rental;
        const existingStart = new Date(existingRental.rentalDate);
        const existingEnd = new Date(existingRental.returnDate);
        if (newRentalStart < existingEnd && newRentalEnd > existingStart) {
            return { message: `Conflito de agendamento. Esta caçamba já está reservada para o período de ${existingStart.toLocaleDateString('pt-BR')} a ${existingEnd.toLocaleDateString('pt-BR')}.` };
        }
    }
    
    await rentalsRef.add({
      ...rentalData,
      accountId,
      createdAt: FieldValue.serverTimestamp(),
    });

    const dumpsterSnap = await db.doc(`accounts/${accountId}/dumpsters/${rentalData.dumpsterId}`).get();
    const dumpsterName = dumpsterSnap.data()?.name || 'Caçamba';
    
    await sendNotification({
        userId: rentalData.assignedTo,
        title: `Nova OS #${newSequentialId} Designada`,
        body: `Você foi designado para a OS da ${dumpsterName}.`,
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
    
    const db = getFirestore(adminApp);
    const batch = db.batch();
    
    try {
        const rentalRef = db.doc(`accounts/${accountId}/rentals/${rentalId}`);
        const rentalSnap = await rentalRef.get();
        
        if (!rentalSnap.exists) {
            throw new Error('OS não encontrada.');
        }
        
        const rentalData = rentalSnap.data() as Rental;

        // Fetch related data to store a complete snapshot
        const clientSnap = await db.doc(`accounts/${accountId}/clients/${rentalData.clientId}`).get();
        const dumpsterSnap = await db.doc(`accounts/${accountId}/dumpsters/${rentalData.dumpsterId}`).get();
        const assignedToSnap = await db.doc(`users/${rentalData.assignedTo}`).get();

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
            totalValue,
            accountId,
            // Store denormalized data for historical integrity
            client: clientSnap.exists() ? clientSnap.data() : null,
            dumpster: dumpsterSnap.exists() ? dumpsterSnap.data() : null,
            assignedToUser: assignedToSnap.exists() ? assignedToSnap.data() : null,
        };
        
        const newCompletedRentalRef = db.collection(`accounts/${accountId}/completed_rentals`).doc();
        batch.set(newCompletedRentalRef, completedRentalData);

        batch.delete(rentalRef);
        
        await batch.commit();

        revalidatePath('/');
        revalidatePath('/finance');
        
    } catch(e) {
         console.error("Failed to finish rental:", e);
         return { message: 'error', error: handleFirebaseError(e) as string };
    }

    redirect('/');
}

export async function deleteRentalAction(accountId: string, rentalId: string) {
    if (!rentalId) {
        return { message: 'error', error: 'Rental ID is missing.' };
    }
    try {
        await getFirestore(adminApp).doc(`accounts/${accountId}/rentals/${rentalId}`).delete();
        revalidatePath('/');
        return { message: 'success' };
    } catch (e) {
        return { message: 'error', error: handleFirebaseError(e) as string };
    }
}

export async function updateRentalAction(accountId: string, prevState: any, formData: FormData) {
    const rawData = Object.fromEntries(formData.entries());

    let numericValue: number | undefined = undefined;
    if (rawData.value) {
        const rawValue = rawData.value as string;
        numericValue = parseFloat(rawValue.replace('R$', '').replace(/\./g, '').replace(',', '.').trim());
    }
    
    const dataToValidate = {
        ...rawData,
        value: numericValue,
    };

    const validatedFields = UpdateRentalSchema.safeParse(dataToValidate);

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'error',
        };
    }
    
    const { id, ...rentalData } = validatedFields.data;
    
    const updateData = Object.fromEntries(Object.entries(rentalData).filter(([_, v]) => v !== undefined));

    if (Object.keys(updateData).length === 0) {
        return { message: 'success', info: 'Nenhum campo para atualizar.' };
    }

    try {
        const rentalDoc = getFirestore(adminApp).doc(`accounts/${accountId}/rentals/${id}`);
        
        const rentalBeforeUpdate = (await rentalDoc.get()).data() as Rental;
        
        await rentalDoc.update({
          ...updateData,
          updatedAt: FieldValue.serverTimestamp(),
        });

        if (updateData.assignedTo && updateData.assignedTo !== rentalBeforeUpdate.assignedTo) {
            const clientSnap = await adminDb.doc(`accounts/${accountId}/clients/${rentalBeforeUpdate.clientId}`).get();
            const clientName = clientSnap.data()?.name || 'Cliente';

            await sendNotification({
                userId: updateData.assignedTo,
                title: 'Você foi designado para uma OS',
                body: `Você agora é o responsável pela OS para ${clientName}.`,
            });
        }
        
        revalidatePath('/');
    } catch (e) {
        return { message: 'error', error: handleFirebaseError(e) as string };
    }
    redirect('/');
}


// #endregion

// #region Settings & Reset Actions

export async function updateRentalPricesAction(accountId: string, prices: RentalPrice[]) {
    const validatedFields = z.array(RentalPriceSchema).safeParse(prices);
    
    if (!validatedFields.success) {
        const error = validatedFields.error.flatten().fieldErrors;
        console.error("Price validation error:", error);
        return {
            message: 'error',
            error: JSON.stringify(error),
        };
    }

    try {
        const accountRef = getFirestore(adminApp).doc(`accounts/${accountId}`);
        await accountRef.update({
            rentalPrices: validatedFields.data ?? []
        });
        revalidatePath('/settings');
        revalidatePath('/rentals/new');
        return { message: 'success' };
    } catch (e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }
}

async function deleteCollection(db: FirebaseFirestore.Firestore, collectionPath: string, batchSize: number) {
    const collectionRef = db.collection(collectionPath);
    const query = collectionRef.orderBy('__name__').limit(batchSize);

    return new Promise((resolve, reject) => {
        deleteQueryBatch(db, query, resolve).catch(reject);
    });
}

async function deleteQueryBatch(db: FirebaseFirestore.Firestore, query: FirebaseFirestore.Query, resolve: (value: unknown) => void) {
    const snapshot = await query.get();

    const batchSize = snapshot.size;
    if (batchSize === 0) {
        resolve(true);
        return;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });
    await batch.commit();

    process.nextTick(() => {
        deleteQueryBatch(db, query, resolve);
    });
}

export async function resetFinancialDataAction(accountId: string) {
     if (!accountId) {
        return { message: 'error', error: 'Conta não identificada.' };
    }
    try {
        const db = getFirestore(adminApp);
        await deleteCollection(db, `accounts/${accountId}/completed_rentals`, 50);

        revalidatePath('/finance');
        return { message: 'success' };
    } catch (e) {
         return { message: 'error', error: handleFirebaseError(e) };
    }
}


export async function resetAllDataAction(accountId: string) {
    if (!accountId) {
        return { message: 'error', error: 'Conta não identificada.' };
    }

    try {
        const db = getFirestore(adminApp);
        
        const collectionsToDelete = ['clients', 'dumpsters', 'rentals', 'completed_rentals'];
        for (const collection of collectionsToDelete) {
            await deleteCollection(db, `accounts/${accountId}/${collection}`, 50);
        }
        
        await db.doc(`accounts/${accountId}`).update({
            rentalPrices: [],
            rentalCounter: 0,
        });


        revalidatePath('/');
        revalidatePath('/clients');
        revalidatePath('/dumpsters');
        revalidatePath('/finance');
        revalidatePath('/settings');
        
        return { message: 'success' };
    } catch (e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }
}

// #endregion


// #region Backup Actions

export async function updateBackupSettingsAction(accountId: string, prevState: any, formData: FormData) {
    if (!accountId) return { message: 'error', error: 'Conta não identificada.' };

    const validatedFields = UpdateBackupSettingsSchema.safeParse(Object.fromEntries(formData.entries()));

    if (!validatedFields.success) {
        return { 
            message: 'error', 
            error: validatedFields.error.flatten().fieldErrors.backupPeriodicityDays?.[0] || validatedFields.error.flatten().fieldErrors.backupRetentionDays?.[0] || 'Dados inválidos.' 
        };
    }

    try {
        const accountRef = getFirestore(adminApp).doc(`accounts/${accountId}`);
        await accountRef.update({
            backupPeriodicityDays: validatedFields.data.backupPeriodicityDays,
            backupRetentionDays: validatedFields.data.backupRetentionDays,
        });
        revalidatePath('/settings');
        return { message: 'success' };
    } catch (e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }
}


async function copyCollection(
    db: FirebaseFirestore.Firestore,
    sourcePath: string,
    destPath: string
) {
    const sourceRef = db.collection(sourcePath);
    const documents = await sourceRef.get();
    
    let batch = db.batch();
    let i = 0;
    for (const doc of documents.docs) {
        const destRef = db.doc(`${destPath}/${doc.id}`);
        batch.set(destRef, doc.data());
        i++;
        if (i % 500 === 0) { // Commit every 500 documents
            await batch.commit();
            batch = db.batch();
        }
    }
    if (i % 500 !== 0) {
        await batch.commit();
    }
}


export async function createFirestoreBackupAction(accountId: string, retentionDays?: number) {
    if (!accountId) {
        return { message: 'error', error: 'Conta não identificada.' };
    }

    const db = adminDb;
    const timestamp = new Date();
    const backupId = `backup-${timestamp.toISOString()}`;
    const backupDocRef = db.collection(`backups`).doc(backupId);
    
    try {
        await db.runTransaction(async (transaction) => {
            transaction.set(backupDocRef, {
                accountId: accountId,
                createdAt: timestamp,
                status: 'in-progress'
            });
        });
        
        const subcollectionsToBackup = ['clients', 'dumpsters', 'rentals', 'completed_rentals'];
        const accountDoc = await db.doc(`accounts/${accountId}`).get();
        
        if (accountDoc.exists) {
            const accountData = accountDoc.data();
            const backupAccountRef = db.doc(`backups/${backupId}/accounts/${accountId}`);
            await backupAccountRef.set(accountData!);
        }

        for (const subcollection of subcollectionsToBackup) {
             const sourcePath = `accounts/${accountId}/${subcollection}`;
             const destPath = `backups/${backupId}/accounts/${accountId}/${subcollection}`;
             await copyCollection(db, sourcePath, destPath);
        }

        await backupDocRef.update({ status: 'completed' });
        
        const accountRef = db.doc(`accounts/${accountId}`);
        await accountRef.update({ lastBackupDate: timestamp.toISOString() });

        if (typeof retentionDays === 'number' && retentionDays > 0) {
            await cleanupOldBackupsAction(accountId, retentionDays);
        }
        
        revalidatePath('/settings');
        return { message: 'success' };

    } catch (e) {
        await backupDocRef.update({ status: 'failed', error: handleFirebaseError(e) });
        return { message: 'error', error: handleFirebaseError(e) };
    }
}

export async function cleanupOldBackupsAction(accountId: string, retentionDays: number) {
    const db = adminDb;
    const now = new Date();
    const retentionDate = new Date(now.setDate(now.getDate() - retentionDays));

    const oldBackupsQuery = db.collection('backups')
        .where('accountId', '==', accountId)
        .where('createdAt', '<', retentionDate)
        .where('status', '==', 'completed');
        
    const snapshot = await oldBackupsQuery.get();

    if (snapshot.empty) {
        console.log("No old backups to delete.");
        return { message: 'success', info: 'No old backups found.' };
    }
    
    const deletePromises: Promise<any>[] = [];
    snapshot.forEach(doc => {
        console.log(`Scheduling deletion for old backup: ${doc.id}`);
        deletePromises.push(deleteFirestoreBackupAction(accountId, doc.id));
    });

    try {
        await Promise.all(deletePromises);
        console.log(`Successfully deleted ${deletePromises.length} old backups.`);
        return { message: 'success', deletedCount: deletePromises.length };
    } catch(e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }
}


export async function restoreFirestoreBackupAction(accountId: string, backupId: string) {
    if (!accountId || !backupId) {
        return { message: 'error', error: 'IDs de conta ou backup ausentes.' };
    }

    const db = adminDb;
    const subcollections = ['clients', 'dumpsters', 'rentals', 'completed_rentals'];

    try {
        for (const collection of subcollections) {
            await deleteCollection(db, `accounts/${accountId}/${collection}`, 50);
        }

        const backupAccountRef = db.doc(`backups/${backupId}/accounts/${accountId}`);
        const backupAccountSnap = await backupAccountRef.get();

        if (!backupAccountSnap.exists) {
            throw new Error("Documento de conta do backup não encontrado.");
        }
        const accountData = backupAccountSnap.data();
        if (accountData) {
            accountData.lastBackupDate = new Date().toISOString();
        }
        await db.doc(`accounts/${accountId}`).set(accountData!);

        for (const collection of subcollections) {
            const sourcePath = `backups/${backupId}/accounts/${accountId}/${collection}`;
            const destPath = `accounts/${accountId}/${collection}`;
            await copyCollection(db, sourcePath, destPath);
        }

        revalidatePath('/settings');
        revalidatePath('/');
        return { message: 'success' };
    } catch (e) {
        console.error("Restore Error:", e);
        return { message: 'error', error: handleFirebaseError(e) };
    }
}

export async function deleteFirestoreBackupAction(accountId: string, backupId: string) {
    if (!accountId || !backupId) {
        return { message: 'error', error: 'IDs de conta ou backup ausentes.' };
    }

    const db = adminDb;
    const backupDocRef = db.doc(`backups/${backupId}`);

    try {
        const backupSnap = await backupDocRef.get();
        if (!backupSnap.exists || backupSnap.data()?.accountId !== accountId) {
            throw new Error("Backup não encontrado ou você não tem permissão para excluí-lo.");
        }
        
        const subcollections = ['accounts'];
        for (const collection of subcollections) {
            await deleteCollection(db, `backups/${backupId}/${collection}`, 50);
        }
        
        await backupDocRef.delete();
        
        revalidatePath('/settings');
        return { message: 'success' };
    } catch (e) {
        console.error("Delete Backup Error:", e);
        return { message: 'error', error: handleFirebaseError(e) };
    }
}


// #endregion

// #region Notification Actions
export async function checkAndSendDueNotificationsAction(accountId: string) {
    if (!accountId) {
        console.error("checkAndSendDueNotificationsAction called without accountId");
        return;
    }

    const db = adminDb;
    const rentalsRef = db.collection(`accounts/${accountId}/rentals`);
    const rentalsSnap = await rentalsRef.get();

    if (rentalsSnap.empty) {
        return;
    }
    
    const today = startOfToday();
    const tomorrow = addDays(today, 1);
    const batch = db.batch();
    let notificationsSentCount = 0;

    for (const doc of rentalsSnap.docs) {
        const rental = { id: doc.id, ...doc.data() } as Rental;
        const returnDate = parseISO(rental.returnDate);

        if (isToday(addDays(returnDate, -1)) && !rental.notificationsSent?.due) {
            await sendNotification({
                userId: rental.assignedTo,
                title: 'Lembrete de Retirada',
                body: `A OS para ${rental.deliveryAddress} vence amanhã.`,
            });
            batch.update(doc.ref, { 'notificationsSent.due': true });
            notificationsSentCount++;
        }

        if (isAfter(today, returnDate) && !rental.notificationsSent?.late) {
             await sendNotification({
                userId: rental.assignedTo,
                title: 'OS Atrasada!',
                body: `A OS para ${rental.deliveryAddress} está atrasada.`,
            });
            batch.update(doc.ref, { 'notificationsSent.late': true });
            notificationsSentCount++;
        }
    }
    
    if (notificationsSentCount > 0) {
        await batch.commit();
        console.log(`Committed ${notificationsSentCount} notification status updates.`);
    }
}

export async function sendPushNotificationAction(formData: FormData) {
    const NotificationSchema = z.object({
        title: z.string().min(1, 'O título é obrigatório.'),
        message: z.string().min(1, 'A mensagem é obrigatória.'),
        targetType: z.enum(['all-company', 'specific-clients', 'specific-users', 'my-team', 'specific-members']),
        targetIds: z.string().optional(),
        senderAccountId: z.string(),
    });

    const parsed = NotificationSchema.safeParse(Object.fromEntries(formData.entries()));

    if (!parsed.success) {
        return { message: 'error', error: 'Dados do formulário inválidos.' };
    }
    
    const { title, message, targetType, targetIds, senderAccountId } = parsed.data;
    
    try {
        let recipientIds: string[] = [];
        
        switch (targetType) {
            case 'all-company':
                const usersSnap = await adminDb.collection('users').get();
                recipientIds = usersSnap.docs.map(d => d.id);
                break;
            case 'my-team': {
                const accountSnap = await adminDb.doc(`accounts/${senderAccountId}`).get();
                recipientIds = accountSnap.data()?.members || [];
                break;
            }
            case 'specific-members': {
                recipientIds = targetIds ? targetIds.split(',') : [];
                break;
            }
            case 'specific-clients': {
                if (!targetIds) break;
                const accountIds = targetIds.split(',');
                const accountPromises = accountIds.map(id => adminDb.doc(`accounts/${id}`).get());
                const accountSnaps = await Promise.all(accountPromises);
                recipientIds = accountSnaps.flatMap(snap => snap.data()?.members || []);
                break;
            }
            case 'specific-users': {
                 if (!targetIds) break;
                 recipientIds = targetIds.split(',');
                 break;
            }
        }

        if (recipientIds.length === 0) {
            return { message: 'error', error: 'Nenhum destinatário encontrado para a seleção.' };
        }

        const uniqueRecipientIds = [...new Set(recipientIds)];
        
        const notificationPromises = uniqueRecipientIds.map(userId => 
            sendNotification({
                userId,
                title,
                body: message,
            })
        );
        
        await Promise.all(notificationPromises);

        return { message: 'success' };
    } catch(e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }
}

export async function sendFirstLoginNotificationToSuperAdminAction(newClientName: string) {
    const SUPER_ADMIN_EMAIL = 'contato@econtrol.com.br';
    if (!SUPER_ADMIN_EMAIL) {
        console.error('SUPER_ADMIN_EMAIL is not set.');
        return;
    }

    try {
        const superAdminUser = await adminAuth.getUserByEmail(SUPER_ADMIN_EMAIL);
        
        if (superAdminUser) {
            await sendNotification({
                userId: superAdminUser.uid,
                title: 'Novo Cliente Ativado!',
                body: `O cliente ${newClientName} acabou de fazer o primeiro acesso.`,
            });
        }
    } catch (error) {
        console.error('Error sending first login notification to super admin:', error);
    }
}


// #endregion

// #region Super Admin Actions

export async function updateUserStatusAction(userId: string, disabled: boolean) {
    try {
        const userRef = adminDb.doc(`users/${userId}`);
        const userSnap = await userRef.get();

        if (!userSnap.exists) {
            throw new Error("Usuário não encontrado.");
        }

        const userData = userSnap.data() as UserAccount;
        const newStatus: UserStatus = disabled ? 'inativo' : 'ativo';

        if (userData.role === 'owner') {
            const accountRef = adminDb.doc(`accounts/${userData.accountId}`);
            const accountSnap = await accountRef.get();
            if (accountSnap.exists) {
                const memberIds: string[] = accountSnap.data()?.members || [];
                const batch = adminDb.batch();

                for (const memberId of memberIds) {
                    await adminAuth.updateUser(memberId, { disabled });
                    const memberRef = adminDb.doc(`users/${memberId}`);
                    batch.update(memberRef, { status: newStatus });
                }
                await batch.commit();
            }
        } else {
            await adminAuth.updateUser(userId, { disabled });
            await userRef.update({ status: newStatus });
        }
        
        revalidatePath('/admin/clients');
        return { message: 'success' };
    } catch(e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }
}

export async function deleteClientAccountAction(accountId: string, ownerId: string) {
    if (!accountId || !ownerId) {
        return { message: 'error', error: 'ID da conta ou do proprietário ausente.' };
    }

    try {
        const db = adminDb;
        const batch = db.batch();

        const collectionsToDelete = ['clients', 'dumpsters', 'rentals', 'completed_rentals'];
        for (const collection of collectionsToDelete) {
            await deleteCollection(db, `accounts/${accountId}/${collection}`, 50);
        }

        const accountRef = db.doc(`accounts/${accountId}`);
        const accountSnap = await accountRef.get();
        const memberIds: string[] = accountSnap.data()?.members || [];
        
        memberIds.forEach(userId => {
            const userRef = db.doc(`users/${userId}`);
            batch.delete(userRef);
        });
        
        batch.delete(accountRef);
        
        await batch.commit();
        
        const authDeletePromises = memberIds.map(userId => adminAuth.deleteUser(userId));
        await Promise.all(authDeletePromises);
        
        revalidatePath('/admin/clients');
        return { message: 'success' };

    } catch (e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }
}




// #endregion

    
