

'use server';

import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminAuth, adminDb, adminApp } from './firebase-admin';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ClientSchema, DumpsterSchema, RentalSchema, CompletedRentalSchema, UpdateClientSchema, UpdateDumpsterSchema, UpdateRentalSchema, SignupSchema, UserAccountSchema, PermissionsSchema, RentalPriceSchema, RentalPrice, UpdateBackupSettingsSchema, UpdateUserProfileSchema, Rental, Service, ServiceSchema, UpdateBaseAddressSchema, TruckSchema, UpdateTruckSchema, OperationSchema } from './types';
import type { UserAccount, UserRole, UserStatus, Permissions, Account } from './types';
import { ensureUserDocument } from './data-server';
import { sendNotification } from './notifications';
import { addDays, isBefore, isAfter, isToday, parseISO, startOfToday, format, set } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { getStorage } from 'firebase-admin/storage';

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
            throw new Error("Não foi possível encontrar o proprietário da conta para reatribuir as OS.");
        }
        
        // 3. Find and reassign active rentals and operations
        const rentalsRef = db.collection(`accounts/${accountId}/rentals`).where('assignedTo', '==', userId);
        const operationsRef = db.collection(`accounts/${accountId}/operations`).where('assignedTo', '==', userId);
        
        const [rentalsSnap, operationsSnap] = await Promise.all([rentalsRef.get(), operationsRef.get()]);
        
        rentalsSnap.forEach(doc => batch.update(doc.ref, { assignedTo: ownerId }));
        operationsSnap.forEach(doc => batch.update(doc.ref, { assignedTo: ownerId }));


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
    // Find and delete all rentals and operations associated with this client
    const rentalsRef = db.collection(`accounts/${accountId}/rentals`).where('clientId', '==', clientId);
    const operationsRef = db.collection(`accounts/${accountId}/operations`).where('clientId', '==', clientId);
    const [rentalsSnap, operationsSnap] = await Promise.all([rentalsRef.get(), operationsRef.get()]);

    rentalsSnap.forEach(doc => batch.delete(doc.ref));
    operationsSnap.forEach(doc => batch.delete(doc.ref));

    // Delete the client document
    const clientRef = db.doc(`accounts/${accountId}/clients/${clientId}`);
    batch.delete(clientRef);
    
    await batch.commit();

    revalidatePath('/clients');
    revalidatePath('/'); // Also revalidate home page as OS are deleted
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
        const rentalsRef = db.collection(`accounts/${accountId}/rentals`).where('assignedTo', '==', userId);
        const rentalsSnap = await rentalsRef.get();
        rentalsSnap.forEach(doc => batch.update(doc.ref, { assignedTo: FieldValue.delete() }));

        const operationsRef = db.collection(`accounts/${accountId}/operations`).where('assignedTo', '==', userId);
        const operationsSnap = await operationsRef.get();
        operationsSnap.forEach(doc => batch.update(doc.ref, { assignedTo: FieldValue.delete() }));

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

// #region Truck Actions

export async function createTruckAction(accountId: string, prevState: any, formData: FormData) {
  const validatedFields = TruckSchema.safeParse({
      ...Object.fromEntries(formData.entries()),
      year: Number(formData.get('year')),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'error',
    };
  }

  try {
    const trucksCollection = getFirestore(adminApp).collection(`accounts/${accountId}/trucks`);
    await trucksCollection.add({
      ...validatedFields.data,
      accountId,
      createdAt: FieldValue.serverTimestamp(),
    });
    revalidatePath('/trucks');
    return { message: 'success' };
  } catch (e) {
    return { message: 'error', error: handleFirebaseError(e) };
  }
}


export async function updateTruckAction(accountId: string, prevState: any, formData: FormData) {
  const validatedFields = UpdateTruckSchema.safeParse({
     ...Object.fromEntries(formData.entries()),
      year: Number(formData.get('year')),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'error',
    };
  }

  const { id, ...truckData } = validatedFields.data;

  try {
    const truckDoc = getFirestore(adminApp).doc(`accounts/${accountId}/trucks/${id}`);
    await truckDoc.update({
      ...truckData,
      accountId,
      updatedAt: FieldValue.serverTimestamp(),
    });
    revalidatePath('/trucks');
    revalidatePath('/');
    return { message: 'success' };
  } catch (e) {
    return { message: 'error', error: handleFirebaseError(e) };
  }
}

export async function deleteTruckAction(accountId: string, truckId: string) {
  try {
    await getFirestore(adminApp).doc(`accounts/${accountId}/trucks/${truckId}`).delete();
    revalidatePath('/trucks');
    revalidatePath('/');
    return { message: 'success' };
  } catch (e) {
    return { message: 'error', error: handleFirebaseError(e) };
  }
}
// #endregion


// #region Service Order Actions (Common Logic)

// This function now handles both Rentals and Operations
export async function createServiceOrderAction(accountId: string, createdBy: string, prevState: any, formData: FormData) {
  const db = getFirestore(adminApp);
  const accountRef = db.doc(`accounts/${accountId}`);
  
  const rawData = Object.fromEntries(formData.entries());
  const osType = rawData.osType as 'rental' | 'operation';

  try {
    // Determine which counter to use based on osType
    const counterField = osType === 'rental' ? 'rentalCounter' : 'operationCounter';
    const prefix = osType === 'rental' ? 'AL' : 'OP';

    const newSequentialId = await db.runTransaction(async (transaction) => {
        const accountSnap = await transaction.get(accountRef);
        if (!accountSnap.exists) throw new Error("Conta não encontrada.");
        
        const currentCounter = accountSnap.data()?.[counterField] || 0;
        const newCounter = currentCounter + 1;
        transaction.update(accountRef, { [counterField]: newCounter });
        return `${prefix}-${newCounter}`;
    });
    
    const rawValue = rawData.value as string;
    const numericValue = parseFloat(rawValue.replace('R$', '').replace(/\./g, '').replace(',', '.').trim());
    
    let validatedData;
    let dataToSave;

    const baseData = {
        ...rawData,
        sequentialId: newSequentialId,
        value: numericValue,
        status: 'Pendente',
        createdBy: createdBy,
        accountId: accountId,
        notificationsSent: { due: false, late: false },
        createdAt: FieldValue.serverTimestamp(),
    };

    if (osType === 'rental') {
        validatedData = RentalSchema.safeParse(baseData);
        if (!validatedData.success) {
            return { errors: validatedData.error.flatten().fieldErrors, message: 'error' };
        }
        dataToSave = validatedData.data;

        // Conflict check for rentals
        const rentalsRef = db.collection(`accounts/${accountId}/rentals`);
        const q = rentalsRef.where('dumpsterId', '==', dataToSave.dumpsterId);
        const existingRentalsSnap = await q.get();
        const newRentalStart = new Date(dataToSave.rentalDate);
        const newRentalEnd = new Date(dataToSave.returnDate);

        for (const doc of existingRentalsSnap.docs) {
            const existingRental = doc.data() as Rental;
            const existingStart = new Date(existingRental.rentalDate);
            const existingEnd = new Date(existingRental.returnDate);
            if (newRentalStart < existingEnd && newRentalEnd > existingStart) {
                return { message: `Conflito de agendamento. Esta caçamba já está reservada.` };
            }
        }

        await rentalsRef.add(dataToSave);
    } else { // osType === 'operation'
        validatedData = OperationSchema.safeParse({
            ...baseData,
            serviceIds: rawData.serviceIds ? (rawData.serviceIds as string).split(',') : [],
        });
        if (!validatedData.success) {
            return { errors: validatedData.error.flatten().fieldErrors, message: 'error' };
        }
        dataToSave = validatedData.data;
        const operationsRef = db.collection(`accounts/${accountId}/operations`);
        await operationsRef.add(dataToSave);
    }
    
    // Send Notification
    const resourceSnap = osType === 'rental' 
      ? await db.doc(`accounts/${accountId}/dumpsters/${dataToSave.dumpsterId}`).get()
      : await db.doc(`accounts/${accountId}/trucks/${dataToSave.truckId}`).get();
    const resourceName = resourceSnap.data()?.name || resourceSnap.data()?.model || 'Recurso';
    
    await sendNotification({
        userId: dataToSave.assignedTo,
        title: `Nova OS #${newSequentialId} Designada`,
        body: `Você foi designado para a OS da ${resourceName}.`,
    });

  } catch (e) {
    return { message: handleFirebaseError(e) };
  }

  revalidatePath('/');
  redirect('/');
}


export async function finishRentalAction(accountId: string, formData: FormData) {
    const rentalId = formData.get('rentalId') as string;
    const osType = formData.get('osType') as 'rental' | 'operation';

    if (!rentalId || !accountId || !osType) {
        return { message: 'error', error: 'Dados da OS ou da conta estão ausentes.' };
    }
    
    const db = getFirestore(adminApp);
    const batch = db.batch();
    
    try {
        const collectionName = osType === 'rental' ? 'rentals' : 'operations';
        const rentalRef = db.doc(`accounts/${accountId}/${collectionName}/${rentalId}`);
        const rentalSnap = await rentalRef.get();
        
        if (!rentalSnap.exists) throw new Error('OS não encontrada.');
        
        const rentalData = rentalSnap.data() as Rental; // Using Rental type as it's a superset

        // Fetch related data to store a complete snapshot
        const clientSnap = await db.doc(`accounts/${accountId}/clients/${rentalData.clientId}`).get();
        const dumpsterSnap = rentalData.dumpsterId ? await db.doc(`accounts/${accountId}/dumpsters/${rentalData.dumpsterId}`).get() : null;
        const truckSnap = rentalData.truckId ? await db.doc(`accounts/${accountId}/trucks/${rentalData.truckId}`).get() : null;
        const assignedToSnap = await db.doc(`users/${rentalData.assignedTo}`).get();

        const rentalDate = new Date(rentalData.rentalDate);
        const returnDate = new Date(rentalData.returnDate);
        const diffTime = Math.abs(returnDate.getTime() - rentalDate.getTime());
        const diffDays = osType === 'rental' ? Math.ceil(diffTime / (1000 * 60 * 60 * 24)) : 1;
        const rentalDays = Math.max(diffDays, 1);
        const totalValue = rentalData.osType === 'rental' ? rentalDays * rentalData.value : rentalData.value;
        
        const completedRentalData = {
            ...rentalData,
            originalRentalId: rentalId,
            completedDate: FieldValue.serverTimestamp(),
            rentalDays,
            totalValue,
            accountId,
            client: clientSnap.exists() ? clientSnap.data() : null,
            dumpster: dumpsterSnap?.exists() ? dumpsterSnap.data() : null,
            truck: truckSnap?.exists() ? truckSnap.data() : null,
            assignedToUser: assignedToSnap.exists() ? assignedToSnap.data() : null,
        };
        
        const newCompletedRentalRef = db.collection(`accounts/${accountId}/completed_rentals`).doc();
        batch.set(newCompletedRentalRef, completedRentalData);
        batch.delete(rentalRef);
        
        await batch.commit();

    } catch(e) {
         console.error("Failed to finish OS:", e);
         throw e; 
    }
    
    revalidatePath('/');
    revalidatePath('/finance');
    redirect('/');
}

export async function deleteRentalAction(accountId: string, rentalId: string, osType: 'rental' | 'operation') {
    if (!rentalId || !osType) {
        return { message: 'error', error: 'ID ou tipo da OS estão ausentes.' };
    }
    try {
        const collectionName = osType === 'rental' ? 'rentals' : 'operations';
        await getFirestore(adminApp).doc(`accounts/${accountId}/${collectionName}/${rentalId}`).delete();
        revalidatePath('/');
        return { message: 'success' };
    } catch (e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }
}

export async function updateRentalAction(accountId: string, prevState: any, formData: FormData) {
    const rawData = Object.fromEntries(formData.entries());
    const osType = rawData.osType as 'rental' | 'operation';

    if (!osType) {
        return { message: 'error', error: 'Tipo de OS não especificado.' };
    }

    let numericValue: number | undefined = undefined;
    if (rawData.value) {
        const rawValue = rawData.value as string;
        numericValue = parseFloat(rawValue.replace('R$', '').replace(/\./g, '').replace(',', '.').trim());
    }
    
    const dataToValidate = {
        ...rawData,
        value: numericValue,
        serviceIds: rawData.serviceIds ? (rawData.serviceIds as string).split(',') : undefined,
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
        const collectionName = osType === 'rental' ? 'rentals' : 'operations';
        const rentalDoc = getFirestore(adminApp).doc(`accounts/${accountId}/${collectionName}/${id}`);
        
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

export async function updateBaseAddressAction(accountId: string, prevState: any, formData: FormData) {
    const validatedFields = UpdateBaseAddressSchema.safeParse(Object.fromEntries(formData.entries()));

    if (!validatedFields.success) {
        return { message: 'error', error: validatedFields.error.flatten().fieldErrors.baseAddress?.[0] };
    }

    try {
        const { baseAddress, baseLatitude, baseLongitude } = validatedFields.data;
        const accountRef = getFirestore(adminApp).doc(`accounts/${accountId}`);
        await accountRef.update({
            baseAddress,
            baseLocation: { lat: baseLatitude, lng: baseLongitude },
        });
        revalidatePath('/settings');
        revalidatePath('/rentals/new-operation');
        return { message: 'success' };
    } catch (e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }
}

export async function updateServicesAction(accountId: string, services: Service[]) {
    const validatedFields = z.array(ServiceSchema).safeParse(services);
    
    if (!validatedFields.success) {
        const error = validatedFields.error.flatten().fieldErrors;
        console.error("Service validation error:", error);
        return {
            message: 'error',
            error: JSON.stringify(error),
        };
    }

    try {
        const accountRef = getFirestore(adminApp).doc(`accounts/${accountId}`);
        await accountRef.update({
            services: validatedFields.data ?? []
        });
        revalidatePath('/settings');
        revalidatePath('/rentals/new-operation');
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
        
        const collectionsToDelete = ['clients', 'dumpsters', 'rentals', 'operations', 'completed_rentals', 'trucks'];
        for (const collection of collectionsToDelete) {
            await deleteCollection(db, `accounts/${accountId}/${collection}`, 50);
        }
        
        // Also delete all files in storage for that account
        const bucket = getStorage(adminApp).bucket();
        await bucket.deleteFiles({ prefix: `accounts/${accountId}/` });
        
        await db.doc(`accounts/${accountId}`).update({
            rentalPrices: [],
            rentalCounter: 0,
            operationCounter: 0,
        });


        revalidatePath('/');
        revalidatePath('/clients');
        revalidatePath('/dumpsters');
        revalidatePath('/finance');
        revalidatePath('/settings');
        revalidatePath('/trucks');
        
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
        
        const subcollectionsToBackup = ['clients', 'dumpsters', 'rentals', 'operations', 'completed_rentals', 'trucks'];
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
    const subcollections = ['clients', 'dumpsters', 'rentals', 'operations', 'completed_rentals', 'trucks'];

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
        if (rental.osType !== 'rental') continue; // Only send for rentals

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

        const collectionsToDelete = ['clients', 'dumpsters', 'rentals', 'operations', 'completed_rentals', 'trucks'];
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
