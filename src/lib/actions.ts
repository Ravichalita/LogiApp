

'use server';

import { getFirestore, FieldValue, FieldPath, Timestamp } from 'firebase-admin/firestore';
import { adminAuth, adminDb, adminApp } from './firebase-admin';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ClientSchema, DumpsterSchema, RentalSchema, CompletedRentalSchema, UpdateClientSchema, UpdateDumpsterSchema, UpdateRentalSchema, SignupSchema, UserAccountSchema, PermissionsSchema, RentalPriceSchema, RentalPrice, UpdateBackupSettingsSchema, UpdateUserProfileSchema, Rental, AttachmentSchema, TruckSchema, UpdateTruckSchema, OperationSchema, UpdateOperationSchema, UpdateBasesSchema, OperationalCostSchema, UpdateOperationalCostsSchema, OperationTypeSchema, SuperAdminCreationSchema, TruckTypeSchema, UploadedImage, UploadedImageSchema } from './types';
import type { UserAccount, UserRole, UserStatus, Permissions, Account, Operation, AdditionalCost, Truck, Attachment, TruckType, OperationalCost } from './types';
import { ensureUserDocument } from './data-server';
import { sendNotification } from './notifications';
import { addDays, isBefore, isAfter, isToday, parseISO, startOfToday, format, set } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { getStorage } from 'firebase-admin/storage';
import { headers } from 'next/headers';

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
export async function recoverSuperAdminAction() {
    try {
        await ensureUserDocument({
            name: 'Super Admin',
            email: 'contato@econtrol.com.br',
        }, null, 'superadmin');
        return { message: 'success' };
    } catch (e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }
}

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

export async function updateUserRoleAction(invokerId: string, accountId: string, userId: string, newRole: UserRole) {
    try {
        const db = getFirestore(adminApp);
        
        const accountRef = db.doc(`accounts/${accountId}`);
        const accountSnap = await accountRef.get();
        if (!accountSnap.exists) {
            throw new Error("Conta não encontrada.");
        }
        const ownerId = accountSnap.data()?.ownerId;
        
        // Ensure the person making the change is the owner of the account
        if (invokerId !== ownerId) {
            throw new Error("Apenas proprietários da conta podem alterar funções.");
        }

        const userRef = db.doc(`users/${userId}`);
        const userSnap = await userRef.get();
        if (!userSnap.exists || userSnap.data()?.accountId !== accountId) {
             throw new Error("Usuário não encontrado ou não pertence a esta conta.");
        }
        
        const updates: { role: UserRole, permissions?: Permissions } = { role: newRole };
        
        const ownerRef = db.doc(`users/${ownerId}`);
        const ownerSnap = await ownerRef.get(); // Correctly await the promise

        if (newRole === 'admin') {
            if (ownerSnap.exists) { 
                const ownerData = ownerSnap.data() as UserAccount;
                updates.permissions = ownerData.permissions;
            } else {
                 throw new Error("Documento do proprietário não encontrado para herdar permissões.");
            }
        } else if (newRole === 'viewer') {
            // When demoting to viewer, reset permissions to default (all false)
            updates.permissions = PermissionsSchema.parse({});
        }

        await adminAuth.setCustomUserClaims(userId, { role: newRole, accountId });
        await userRef.update(updates);

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
        if (!userSnap.exists) {
            throw new Error("Usuário não encontrado.");
        }

        const userData = userSnap.data() as UserAccount;
        if (userData.accountId !== accountId) {
            throw new Error("Usuário não pertence a esta conta.");
        }

        const newPermissions = { ...permissions };

        // Cascade logic: if a main screen is disabled, related edit permissions should also be disabled
        if (newPermissions.canAccessOperations === true) {
            newPermissions.canAccessFleet = true;
        } else if (newPermissions.canAccessOperations === false) {
            newPermissions.canAccessFleet = false;
            newPermissions.canEditOperations = false;
        }
        
        if (newPermissions.canAccessRentals === true) {
            newPermissions.canAccessDumpsters = true;
        } else if (newPermissions.canAccessRentals === false) {
            newPermissions.canAccessDumpsters = false;
            newPermissions.canEditRentals = false;
        }

        const validatedPermissions = PermissionsSchema.parse(newPermissions);
        
        const batch = db.batch();
        batch.update(userRef, { permissions: validatedPermissions });
        
        // If the user being updated is an owner, cascade permissions to their admins
        if (userData.role === 'owner') {
             const adminsSnap = await db.collection('users')
                .where('accountId', '==', accountId)
                .where('role', '==', 'admin')
                .get();

            adminsSnap.docs.forEach(d => {
              batch.update(d.ref, { permissions: validatedPermissions });
            });
        }
        
        await batch.commit();

        revalidatePath('/team');
        revalidatePath('/admin/clients');
        revalidatePath('/');
        revalidatePath('/settings');
        return { message: 'success' };
    } catch(e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }
}


export async function removeTeamMemberAction(accountId: string, userId: string) {
    const db = getFirestore(adminApp);
    const batch = db.batch();
    try {
        const userRef = db.doc(`users/${userId}`);
        const userSnap = await userRef.get();
        if (!userSnap.exists || userSnap.data()?.accountId !== accountId) {
             throw new Error("Usuário não encontrado ou não pertence a esta conta.");
        }

        // Prevent super admin from being removed from their own team list this way
        if (userSnap.data()?.role === 'superadmin') {
            throw new Error("Super Admins não podem ser removidos desta forma.");
        }

        const accountRef = db.doc(`accounts/${accountId}`);
        const accountSnap = await accountRef.get();
        const ownerId = accountSnap.data()?.ownerId;
        if (!ownerId) {
            throw new Error("Não foi possível encontrar o proprietário da conta para reatribuir os aluguéis.");
        }
        
        const rentalsRef = db.collection(`accounts/${accountId}/rentals`);
        const rentalsQuery = rentalsRef.where('assignedTo', '==', userId);
        const rentalsSnap = await rentalsQuery.get();
        
        if (!rentalsSnap.empty) {
            rentalsSnap.forEach(doc => {
                batch.update(doc.ref, { assignedTo: ownerId });
            });
        }

        batch.update(accountRef, {
            members: FieldValue.arrayRemove(userId)
        });

        batch.delete(userRef);
        
        await batch.commit();
        
        await adminAuth.deleteUser(userId);

        revalidatePath('/team');
        revalidatePath('/'); 
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
    const rentalsRef = db.collection(`accounts/${accountId}/rentals`);
    const rentalsQuery = rentalsRef.where('clientId', '==', clientId);
    const rentalsSnap = await rentalsQuery.get();

    if (!rentalsSnap.empty) {
      rentalsSnap.forEach(doc => {
        batch.delete(doc.ref);
      });
    }

    const clientRef = db.doc(`accounts/${accountId}/clients/${clientId}`);
    batch.delete(clientRef);
    
    await batch.commit();

    revalidatePath('/clients');
    revalidatePath('/'); 
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
    
    let attachments: Attachment[] = [];
    if (rawData.attachments && typeof rawData.attachments === 'string') {
        try {
            attachments = JSON.parse(rawData.attachments);
        } catch (e) {
            console.error("Failed to parse attachments JSON on createRental");
        }
    }

    let additionalCosts: AdditionalCost[] = [];
    if (rawData.additionalCosts && typeof rawData.additionalCosts === 'string') {
        try {
            additionalCosts = JSON.parse(rawData.additionalCosts);
        } catch (e) {
            console.error("Failed to parse additionalCosts JSON");
        }
    }
    
    const dataToValidate = {
        ...rawData,
        value: Number(rawData.value),
        lumpSumValue: Number(rawData.lumpSumValue),
        travelCost: Number(rawData.travelCost),
        totalCost: Number(rawData.totalCost),
        accountId,
        sequentialId: newSequentialId,
        status: 'Pendente',
        createdBy: createdBy,
        notificationsSent: { due: false, late: false },
        attachments,
        additionalCosts,
    };
    
    const validatedFields = RentalSchema.safeParse(dataToValidate);
    
    if (!validatedFields.success) {
      console.log("Validation errors:", validatedFields.error.flatten().fieldErrors);
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

  revalidatePath('/os');
  redirect('/os');
}

export async function finishRentalAction(accountId: string, formData: FormData) {
    const rentalId = formData.get('rentalId') as string;
    if (!rentalId || !accountId) {
        console.error("finishRentalAction called without rentalId or accountId.");
        return { message: 'error', error: 'ID da OS ou da conta está ausente.' };
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
        const totalValue = rentalData.billingType === 'lumpSum' ? (rentalData.lumpSumValue || 0) : rentalData.value * rentalDays;
        
        const completedRentalData = {
            ...rentalData,
            originalRentalId: rentalId,
            completedDate: FieldValue.serverTimestamp(),
            rentalDays,
            totalValue,
            accountId,
            // Store denormalized data for historical integrity
            client: clientSnap.exists ? clientSnap.data() : null,
            dumpster: dumpsterSnap.exists ? dumpsterSnap.data() : null,
            assignedToUser: assignedToSnap.exists ? assignedToSnap.data() : null,
        };
        
        const newCompletedRentalRef = db.collection(`accounts/${accountId}/completed_rentals`).doc();
        batch.set(newCompletedRentalRef, completedRentalData);

        batch.delete(rentalRef);
        
        await batch.commit();

    } catch(e) {
         console.error("Failed to finish rental:", e);
         throw e; 
    }
    
    revalidatePath('/');
    revalidatePath('/finance');
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
    const dataToValidate: Record<string, any> = { ...rawData };
    
    if (rawData.value !== undefined) {
        dataToValidate.value = Number(rawData.value);
    }

    if (rawData.attachments && typeof rawData.attachments === 'string') {
        try {
            dataToValidate.attachments = JSON.parse(rawData.attachments);
        } catch(e) {
            return { message: 'error', error: 'Formato de anexo inválido.' };
        }
    }
    
    if (rawData.additionalCosts && typeof rawData.additionalCosts === 'string') {
        try {
            dataToValidate.additionalCosts = JSON.parse(rawData.additionalCosts);
        } catch (e) {
            return { message: 'error', error: "Formato de custos adicionais inválido."}
        }
    }

    const validatedFields = UpdateRentalSchema.safeParse(dataToValidate);

    if (!validatedFields.success) {
        console.log("Update validation errors:", validatedFields.error.flatten().fieldErrors);
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'error',
        };
    }
    
    const { id, ...rentalData } = validatedFields.data;
    
    const updateData = Object.fromEntries(Object.entries(rentalData).filter(([_, v]) => v !== undefined && v !== null));

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
        revalidatePath('/os');
    } catch (e) {
        return { message: 'error', error: handleFirebaseError(e) as string };
    }

    // Only redirect if coming from the edit page, not from a simple attachment update
    const headersList = headers();
    const referer = headersList.get('referer');
    if (referer?.includes('/edit')) {
        redirect('/os');
    }
}

export async function addAttachmentToRentalAction(accountId: string, rentalId: string, attachment: z.infer<typeof AttachmentSchema>, collectionName: 'rentals' | 'completed_rentals') {
    if (!accountId || !rentalId) return { message: 'error', error: 'ID da conta ou do aluguel ausente.' };

    try {
        const rentalRef = adminDb.doc(`accounts/${accountId}/${collectionName}/${rentalId}`);
        await rentalRef.update({
            attachments: FieldValue.arrayUnion(attachment)
        });
        revalidatePath(collectionName === 'rentals' ? '/os' : '/finance');
        return { message: 'success' };
    } catch(e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }
}

export async function addAttachmentToOperationAction(accountId: string, operationId: string, attachment: z.infer<typeof AttachmentSchema>, collectionName: 'operations' | 'completed_operations') {
    if (!accountId || !operationId) return { message: 'error', error: 'ID da conta ou da operação ausente.' };
    try {
        const opRef = adminDb.doc(`accounts/${accountId}/${collectionName}/${operationId}`);
        await opRef.update({
            attachments: FieldValue.arrayUnion(attachment)
        });
        revalidatePath(collectionName === 'operations' ? '/os' : '/finance');
        return { message: 'success' };
    } catch(e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }
}

export async function deleteAttachmentAction(accountId: string, itemId: string, itemKind: 'rentals' | 'operations' | 'completed_rentals' | 'completed_operations', attachment: Attachment) {
    if (!accountId || !itemId || !itemKind) return { message: 'error', error: 'Informações incompletas para excluir anexo.' };
    
    try {
        const itemRef = adminDb.doc(`accounts/${accountId}/${itemKind}/${itemId}`);
        await itemRef.update({
            attachments: FieldValue.arrayRemove(attachment)
        });

        // The file is deleted from storage on the client side before calling this action for better UX.
        // If that fails, the user will be notified, and they can try again.
        // We avoid deleting from here to prevent leaving orphan files if the DB update fails.
        
        revalidatePath('/os');
        revalidatePath('/finance');
        return { message: 'success' };
    } catch(e) {
        console.error("Error deleting attachment reference from DB:", e);
        return { message: 'error', error: handleFirebaseError(e) };
    }
}


// #endregion

// #region Operation Actions

export async function createOperationAction(accountId: string, createdBy: string, prevState: any, formData: FormData) {
  const db = getFirestore(adminApp);
  const accountRef = db.doc(`accounts/${accountId}`);
  
  try {
    const newSequentialId = await db.runTransaction(async (transaction) => {
        const accountSnap = await transaction.get(accountRef);
        if (!accountSnap.exists) {
            throw new Error("Conta não encontrada.");
        }
        const currentCounter = accountSnap.data()?.operationCounter || 0;
        const newCounter = currentCounter + 1;
        transaction.update(accountRef, { operationCounter: newCounter });
        return newCounter;
    });

    const rawData = Object.fromEntries(formData.entries());
    
    const rawValue = rawData.value as string;
    const value = rawValue ? parseFloat(rawValue) : 0;
    
    let additionalCosts: AdditionalCost[] = [];
    if (rawData.additionalCosts && typeof rawData.additionalCosts === 'string') {
        try {
            additionalCosts = JSON.parse(rawData.additionalCosts);
        } catch (e) {
            console.error("Failed to parse additionalCosts JSON");
        }
    }
    
    let typeIds: string[] = [];
    if (rawData.typeIds && typeof rawData.typeIds === 'string') {
        try {
            typeIds = JSON.parse(rawData.typeIds);
        } catch (e) {
            console.error("Failed to parse typeIds JSON");
        }
    }
    
    let attachments: Attachment[] = [];
    if (rawData.attachments && typeof rawData.attachments === 'string') {
        try {
            attachments = JSON.parse(rawData.attachments);
        } catch (e) {
            console.error("Failed to parse attachments JSON");
        }
    }

    const travelCost = rawData.travelCost ? parseFloat(rawData.travelCost as string) : 0;
    const additionalCostsTotal = additionalCosts.reduce((acc, cost) => acc + (cost?.value || 0), 0);
    const totalCost = travelCost + additionalCostsTotal;

    const dataToValidate = {
         ...rawData,
         typeIds,
         sequentialId: newSequentialId,
         status: 'Pendente',
         createdBy: createdBy,
         accountId,
         value,
         travelCost,
         totalCost,
         additionalCosts,
         attachments,
    };
    
    const validatedFields = OperationSchema.safeParse(dataToValidate);
    
    if (!validatedFields.success) {
      return {
        errors: validatedFields.error.flatten().fieldErrors,
        message: 'error',
      };
    }
    
    const { ...operationData } = validatedFields.data;

    const finalData = Object.fromEntries(Object.entries(operationData).filter(([_, v]) => v !== undefined));

    const opDocRef = await db.collection(`accounts/${accountId}/operations`).add({
      ...finalData,
      createdAt: FieldValue.serverTimestamp(),
    });
    
    if (operationData.truckId) {
        await db.doc(`accounts/${accountId}/trucks/${operationData.truckId}`).update({ status: 'Em Operação' });
    }

    if (validatedFields.data.driverId) {
        await sendNotification({
            userId: validatedFields.data.driverId,
            title: `Nova Operação #${newSequentialId} Designada`,
            body: `Você foi designado para uma operação.`,
        });
    }

  } catch (e) {
    return { message: 'error', error: handleFirebaseError(e) as string };
  }

  revalidatePath('/os');
  redirect('/os');
}

export async function updateOperationAction(accountId: string, prevState: any, formData: FormData) {
    const rawData = Object.fromEntries(formData.entries());
    const dataToValidate: Record<string, any> = { ...rawData };

    if (rawData.additionalCosts && typeof rawData.additionalCosts === 'string') {
        try {
            dataToValidate.additionalCosts = JSON.parse(rawData.additionalCosts);
        } catch (e) {
            return { message: 'error', error: "Formato de custos adicionais inválido."}
        }
    }
    
    if (rawData.typeIds && typeof rawData.typeIds === 'string') {
        try {
            dataToValidate.typeIds = JSON.parse(rawData.typeIds);
        } catch (e) {
            return { message: 'error', error: "Formato de tipos de operação inválido."}
        }
    }
    
    if (rawData.attachments && typeof rawData.attachments === 'string') {
        try {
            dataToValidate.attachments = JSON.parse(rawData.attachments);
        } catch (e) {
            return { message: 'error', error: "Formato de anexos inválido."}
        }
    }
    
    if (rawData.value !== undefined) {
      dataToValidate.value = Number(rawData.value);
    }
    
    if (rawData.travelCost !== undefined) {
        dataToValidate.travelCost = Number(rawData.travelCost);
    }

    const validatedFields = UpdateOperationSchema.safeParse(dataToValidate);

    if (!validatedFields.success) {
        console.log('Update Op Validation Error:', validatedFields.error.flatten().fieldErrors);
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'error',
        };
    }

    const { id, ...operationData } = validatedFields.data;
    const updateData = Object.fromEntries(Object.entries(operationData).filter(([_, v]) => v !== undefined && v !== null));

    if (Object.keys(updateData).length === 0) {
        return { message: 'success', info: 'Nenhum campo para atualizar.' };
    }

    try {
        const operationRef = adminDb.doc(`accounts/${accountId}/operations/${id}`);
        await operationRef.update({
            ...updateData,
            updatedAt: FieldValue.serverTimestamp(),
        });
        revalidatePath('/operations');
        revalidatePath('/os');
    } catch (e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }
    redirect('/os');
}


export async function finishOperationAction(accountId: string, operationId: string) {
    if (!accountId || !operationId) {
        return { message: 'error', error: 'ID da conta ou da operação está ausente.' };
    }
    const db = adminDb;
    const batch = db.batch();

    try {
        const operationRef = db.doc(`accounts/${accountId}/operations/${operationId}`);
        const operationSnap = await operationRef.get();
        if (!operationSnap.exists) {
            throw new Error("Operação não encontrada.");
        }
        
        const operationData = operationSnap.data() as Operation;
        const completedOpData = {
            ...operationData,
            status: 'Concluído',
            completedAt: FieldValue.serverTimestamp(),
        };

        const newCompletedRef = db.collection(`accounts/${accountId}/completed_operations`).doc();
        batch.set(newCompletedRef, completedOpData);
        batch.delete(operationRef);

        if (operationData.truckId) {
            const truckRef = db.doc(`accounts/${accountId}/trucks/${operationData.truckId}`);
            batch.update(truckRef, { status: 'Disponível' });
        }

        await batch.commit();

        revalidatePath('/operations');
        revalidatePath('/finance');
        revalidatePath('/os');
        revalidatePath('/fleet');
        return { message: 'success' };
    } catch (e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }
}

export async function deleteOperationAction(accountId: string, operationId: string) {
    if (!accountId || !operationId) {
        return { message: 'error', error: 'ID da conta ou da operação está ausente.' };
    }
    const db = adminDb;
    try {
        const opRef = db.doc(`accounts/${accountId}/operations/${operationId}`);
        const opSnap = await opRef.get();
        if (opSnap.exists) {
            const opData = opSnap.data() as Operation;
            if (opData.truckId) {
                const truckRef = db.doc(`accounts/${accountId}/trucks/${opData.truckId}`);
                await truckRef.update({ status: 'Disponível' });
            }
        }
        await opRef.delete();
        revalidatePath('/operations');
        revalidatePath('/os');
        revalidatePath('/fleet');
        return { message: 'success' };
    } catch (e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }
}


// #endregion

// #region Fleet Actions
export async function createTruckAction(accountId: string, prevState: any, formData: FormData) {
  const validatedFields = TruckSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'error',
    };
  }

  try {
    const trucksCollection = adminDb.collection(`accounts/${accountId}/trucks`);
    await trucksCollection.add({
      ...validatedFields.data,
      accountId,
      createdAt: FieldValue.serverTimestamp(),
    });
    revalidatePath('/fleet');
    return { message: 'success' };
  } catch (e) {
    return { message: 'error', error: handleFirebaseError(e) };
  }
}

export async function updateTruckAction(accountId: string, prevState: any, formData: FormData) {
  const validatedFields = UpdateTruckSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'error',
    };
  }
  
  const { id, ...truckData } = validatedFields.data;

  try {
    const truckDoc = adminDb.doc(`accounts/${accountId}/trucks/${id}`);
    await truckDoc.update({
      ...truckData,
      updatedAt: FieldValue.serverTimestamp(),
    });
    revalidatePath('/fleet');
    return { message: 'success' };
  } catch (e) {
    return { message: 'error', error: handleFirebaseError(e) };
  }
}

export async function deleteTruckAction(accountId: string, truckId: string) {
  try {
    await adminDb.doc(`accounts/${accountId}/trucks/${truckId}`).delete();
    revalidatePath('/fleet');
    return { message: 'success' };
  } catch (e) {
    return { message: 'error', error: handleFirebaseError(e) };
  }
}

export async function updateTruckStatusAction(accountId: string, truckId: string, newStatus: Truck['status']) {
  try {
    const truckRef = adminDb.doc(`accounts/${accountId}/trucks/${truckId}`);
    await truckRef.update({ status: newStatus });
    revalidatePath('/fleet');
    return { message: 'success' };
  } catch (e) {
    return { message: 'error', error: handleFirebaseError(e) };
  }
}
// #endregion

// #region Settings & Reset Actions

export async function updateBasesAction(accountId: string, bases: any[]) {
    const validatedFields = UpdateBasesSchema.safeParse({ bases });

    if (!validatedFields.success) {
        console.error("Base validation error:", validatedFields.error.flatten().fieldErrors);
        return {
            message: 'error' as const,
            error: JSON.stringify(validatedFields.error.flatten().fieldErrors),
        };
    }
    
    try {
        const accountRef = getFirestore(adminApp).doc(`accounts/${accountId}`);
        await accountRef.update({
            bases: validatedFields.data.bases ?? []
        });
        revalidatePath('/settings');
        revalidatePath('/operations/new');
        return { message: 'success' as const };
    } catch (e) {
        return { message: 'error' as const, error: handleFirebaseError(e) };
    }
}


export async function updateOperationTypesAction(accountId: string, types: OperationType[]) {
    const validatedFields = z.array(OperationTypeSchema).safeParse(types);

    if (!validatedFields.success) {
        return { message: 'error', error: "Tipos de operação inválidos." };
    }

    try {
        const accountRef = getFirestore(adminApp).doc(`accounts/${accountId}`);
        await accountRef.update({ operationTypes: validatedFields.data });
        revalidatePath('/settings');
        revalidatePath('/operations/new');
        return { message: 'success' };
    } catch(e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }
}

export async function updateTruckTypesAction(accountId: string, types: TruckType[]) {
    const validatedFields = z.array(TruckTypeSchema).safeParse(types);

    if (!validatedFields.success) {
        return { message: 'error', error: "Tipos de caminhão inválidos." };
    }

    try {
        const accountRef = getFirestore(adminApp).doc(`accounts/${accountId}`);
        await accountRef.update({ truckTypes: validatedFields.data });
        revalidatePath('/fleet');
        return { message: 'success' };
    } catch(e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }
}


export async function updateOperationalCostsAction(accountId: string, costs: OperationalCost[]) {
    const validatedFields = UpdateOperationalCostsSchema.safeParse({ operationalCosts: costs });
    
    if (!validatedFields.success) {
        return {
            message: 'error' as const,
            error: "Dados de custo inválidos."
        };
    }

    try {
        const accountRef = getFirestore(adminApp).doc(`accounts/${accountId}`);
        await accountRef.update({
            operationalCosts: validatedFields.data.operationalCosts ?? []
        });
        revalidatePath('/settings');
        return { message: 'success' as const };
    } catch (e) {
        return { message: 'error' as const, error: handleFirebaseError(e) };
    }
}

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

async function deleteCollection(db: FirebaseFirestore.Firestore, query: FirebaseFirestore.Query, resolve: (value: unknown) => void) {
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
        deleteCollection(db, query, resolve);
    });
}

async function deleteCollectionByPath(db: FirebaseFirestore.Firestore, collectionPath: string, batchSize: number) {
    const collectionRef = db.collection(collectionPath);
    const collectionDoc = await collectionRef.limit(1).get();

    // If the collection doesn't exist, we don't need to do anything.
    if(collectionDoc.empty) {
        return;
    }

    const query = collectionRef.orderBy('__name__').limit(batchSize);

    return new Promise((resolve, reject) => {
        deleteCollection(db, query, resolve).catch(reject);
    });
}

export async function resetCompletedRentalsAction(accountId: string) {
    if (!accountId) return { message: 'error', error: 'Conta não identificada.' };
    try {
        await deleteCollectionByPath(adminDb, `accounts/${accountId}/completed_rentals`, 50);
        revalidatePath('/finance');
        return { message: 'success' };
    } catch (e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }
}

export async function resetCompletedOperationsAction(accountId: string) {
    if (!accountId) return { message: 'error', error: 'Conta não identificada.' };
    try {
        await deleteCollectionByPath(adminDb, `accounts/${accountId}/completed_operations`, 50);
        revalidatePath('/finance');
        return { message: 'success' };
    } catch (e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }
}

export async function resetActiveRentalsAction(accountId: string) {
    if (!accountId) return { message: 'error', error: 'Conta não identificada.' };
    try {
        await deleteCollectionByPath(adminDb, `accounts/${accountId}/rentals`, 50);
        revalidatePath('/');
        return { message: 'success' };
    } catch (e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }
}

export async function resetActiveOperationsAction(accountId: string) {
    if (!accountId) return { message: 'error', error: 'Conta não identificada.' };
    try {
        await deleteCollectionByPath(adminDb, `accounts/${accountId}/operations`, 50);
        revalidatePath('/operations');
        return { message: 'success' };
    } catch (e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }
}

export async function resetAllDataAction(accountId: string) {
    if (!accountId) {
        return { message: 'error', error: 'Conta não identificada.' };
    }

    const db = adminDb;
    const accountRef = db.doc(`accounts/${accountId}`);

    try {
        const collectionsToDelete = ['clients', 'dumpsters', 'rentals', 'completed_rentals', 'trucks', 'operations', 'completed_operations'];
        for (const collection of collectionsToDelete) {
            await deleteCollectionByPath(db, `accounts/${accountId}/${collection}`, 50);
        }
        
        const bucket = getStorage(adminApp).bucket();
        await bucket.deleteFiles({ prefix: `accounts/${accountId}/` });
        
        // Reset all settings fields on the account document
        await accountRef.update({
            rentalPrices: [],
            operationTypes: [],
            truckTypes: [],
            bases: [],
            operationalCosts: [],
            notificationImages: [],
            rentalCounter: 0,
            operationCounter: 0,
        });

        revalidatePath('/');
        revalidatePath('/clients');
        revalidatePath('/dumpsters');
        revalidatePath('/finance');
        revalidatePath('/settings');
        revalidatePath('/fleet');
        revalidatePath('/operations');
        
        return { message: 'success' };
    } catch (e) {
        console.error("Error in resetAllDataAction:", e);
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
        
        const subcollectionsToBackup = ['clients', 'dumpsters', 'rentals', 'completed_rentals', 'trucks', 'operations', 'completed_operations'];
        const accountDoc = await db.doc(`accounts/${accountId}`).get();
        
        if (accountDoc.exists) {
            const accountData = accountDoc.data();
            const backupAccountRef = db.doc(`backups/${backupId}/accounts/${accountId}`);
            // Backup the main account document
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
    const subcollections = ['clients', 'dumpsters', 'rentals', 'completed_rentals', 'trucks', 'operations', 'completed_operations'];

    try {
        for (const collection of subcollections) {
            await deleteCollectionByPath(db, `accounts/${accountId}/${collection}`, 50);
        }

        const backupAccountRef = db.doc(`backups/${backupId}/accounts/${accountId}`);
        const backupAccountSnap = await backupAccountRef.get();

        if (!backupAccountSnap.exists) {
            throw new Error("Documento de conta do backup não encontrado.");
        }
        const accountData = backupAccountSnap.data();
        if (accountData) {
            accountData.lastBackupDate = new Date().toISOString();
            // Restore the main account document
            await db.doc(`accounts/${accountId}`).set(accountData);
        }


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
            await deleteCollectionByPath(db, `backups/${backupId}/${collection}`, 50);
        }
        
        await backupDocRef.delete();
        
        revalidatePath('/settings');
        return { message: 'success' };
    } catch (e) {
        console.error("Delete Backup Error:", e);
        return { message: 'error', error: handleFirebaseError(e) };
    }
}

export async function deleteStorageFileAction(pathOrUrl: string) {
    try {
        let objectPath = pathOrUrl.replace(/^\/+/, "");

        if (/^https?:\/\//.test(objectPath)) {
            const u = new URL(objectPath);
            const afterO = u.pathname.split("/o/")[1] ?? "";
            objectPath = decodeURIComponent(afterO.split("?")[0]);
        }
        
        const bucket = getStorage(adminApp).bucket();
        await bucket.file(objectPath).delete({ ignoreNotFound: true });
        return { message: 'success' };
    } catch (e: any) {
        console.error("Error deleting storage file:", e);
        if (e?.code === 404) {
            return { message: "error", error: "Arquivo não encontrado no bucket (404)." };
        }
        return { message: "error", error: `Falha ao excluir: ${e?.message ?? e}` };
    }
}


// #endregion

// #region Notification Actions
export async function uploadNotificationImageAction(accountId: string, image: UploadedImage) {
  if (!accountId || !image) {
    return { message: 'error' as const, error: 'Dados insuficientes para o upload.' };
  }

  const validatedImage = UploadedImageSchema.safeParse(image);
  if (!validatedImage.success) {
      return { message: 'error' as const, error: 'Objeto de imagem inválido.' };
  }

  try {
    await adminDb.doc(`accounts/${accountId}`).update({
        notificationImages: FieldValue.arrayUnion(validatedImage.data)
    });
    
    revalidatePath('/notifications-studio');
    
    return { message: 'success' as const, newImage: validatedImage.data };

  } catch (e) {
    console.error("Upload server action error:", e);
    return { message: 'error' as const, error: handleFirebaseError(e) };
  }
}

export async function deleteNotificationImageAction(accountId: string, imagePath: string) {
    if (!accountId || !imagePath) {
        return { message: 'error' as const, error: 'Informações incompletas.' };
    }

    try {
        // First, delete the file from storage
        await deleteStorageFileAction(imagePath);

        // Then, remove the reference from the account document
        const accountRef = adminDb.doc(`accounts/${accountId}`);
        const accountSnap = await accountRef.get();
        if (accountSnap.exists) {
            const currentImages: UploadedImage[] = accountSnap.data()?.notificationImages || [];
            const updatedImages = currentImages.filter(img => img.path !== imagePath);
            await accountRef.update({ notificationImages: updatedImages });
        }

        revalidatePath('/notifications-studio');
        return { message: 'success' as const };
    } catch (e) {
        console.error('Error deleting notification image:', e);
        return { message: 'error' as const, error: handleFirebaseError(e) };
    }
}


export async function updateNotificationImagesAction(accountId: string, images: UploadedImage[]) {
  if (!accountId) {
    return { message: 'error', error: 'Conta não identificada.' };
  }
  const validatedImages = z.array(UploadedImageSchema).safeParse(images);
  if (!validatedImages.success) {
    return { message: 'error', error: 'Dados de imagem inválidos.' };
  }
  try {
    const accountRef = adminDb.doc(`accounts/${accountId}`);
    await accountRef.update({ notificationImages: validatedImages.data });
    revalidatePath('/notifications-studio');
    return { message: 'success' };
  } catch (e) {
    return { message: 'error', error: handleFirebaseError(e) };
  }
}

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
        imageUrl: z.string().url('URL da imagem inválida.').optional().or(z.literal('')),
        linkUrl: z.string().url('URL do link inválido.').optional().or(z.literal('')),
        senderAccountId: z.string(),
    });

    const parsed = NotificationSchema.safeParse(Object.fromEntries(formData.entries()));

    if (!parsed.success) {
        const firstError = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
        return { message: 'error', error: firstError || 'Dados do formulário inválidos.' };
    }
    
    const { title, message, targetType, targetIds, imageUrl, linkUrl, senderAccountId } = parsed.data;
    
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
                imageUrl: imageUrl || undefined,
                linkUrl: linkUrl || undefined,
            })
        );
        
        await Promise.all(notificationPromises);

        return { message: 'success' };
    } catch(e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }
}

export async function sendFirstLoginNotificationToSuperAdminAction(newClientName: string) {
    try {
        // Query for the superadmin user instead of relying on a hardcoded email
        const superAdminQuery = await adminDb.collection('users').where('role', '==', 'superadmin').limit(1).get();
        if (superAdminQuery.empty) {
            console.error('No superadmin user found to send notification to.');
            return;
        }
        const superAdminUser = superAdminQuery.docs[0];
        
        await sendNotification({
            userId: superAdminUser.id,
            title: 'Novo Cliente Ativado!',
            body: `O cliente ${newClientName} acabou de fazer o primeiro acesso.`,
        });

    } catch (error) {
        console.error('Error sending first login notification to super admin:', error);
    }
}


// #endregion

// #region Super Admin Actions
export async function createSuperAdminAction(invokerId: string | null, prevState: any, formData: FormData) {
  if (!invokerId) return { message: 'Apenas Super Admins podem criar outros Super Admins.' };

  const invokerUser = await adminAuth.getUser(invokerId);
  if (invokerUser.customClaims?.role !== 'superadmin') {
     return { message: 'Apenas Super Admins podem criar outros Super Admins.' };
  }
  
  const validatedFields = SuperAdminCreationSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!validatedFields.success) {
      return { message: 'Dados do formulário inválidos.' };
  }
  
  const { name, email, password } = validatedFields.data;

  try {
      const { accountId, userId } = await ensureUserDocument({ name, email, password }, null, 'superadmin');
      
      revalidatePath('/admin/superadmins');
      return { message: 'success', newUser: { name, email, password } };

  } catch (e) {
      return { message: handleFirebaseError(e) };
  }
}

export async function deleteSuperAdminAction(userId: string) {
    try {
        await adminAuth.deleteUser(userId);
        await adminDb.doc(`users/${userId}`).delete();
        revalidatePath('/admin/superadmins');
        return { message: 'success' };
    } catch(e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }
}


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

        const collectionsToDelete = ['clients', 'dumpsters', 'rentals', 'completed_rentals', 'trucks', 'operations', 'completed_operations'];
        for (const collection of collectionsToDelete) {
            await deleteCollectionByPath(db, `accounts/${accountId}/${collection}`, 50);
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









    

    










    
