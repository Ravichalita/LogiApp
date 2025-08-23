
'use server';

import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminAuth } from './firebase-admin';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ClientSchema, DumpsterSchema, RentalSchema, CompletedRentalSchema, UpdateClientSchema, UpdateDumpsterSchema, UpdateRentalSchema, SignupSchema, UserAccountSchema, PermissionsSchema, RentalPricesSchema } from './types';
import type { Rental, UserAccount, UserRole, UserStatus, Permissions } from './types';
import { ensureUserDocument } from './data-server';

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
  const isInviteFlow = !!inviterAccountId;

  try {
      // This is the CRITICAL step. This server-side function creates the Auth user,
      // the DB entries, AND sets the custom claims in one go.
      // If it fails, it cleans up after itself.
      await ensureUserDocument({ name, email, password }, inviterAccountId);
      
      const successState = {
        ...prevState,
        message: 'success',
        newUser: {
          name,
          email,
          password: isInviteFlow ? password : undefined, // Only return password on invite flow
        },
      };
      
      return successState;

  } catch (e) {
      return { ...prevState, message: handleFirebaseError(e) };
  }
}

export async function updateUserRoleAction(accountId: string, userId: string, newRole: UserRole) {
    try {
        const db = getFirestore();
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
        const db = getFirestore();
        const userRef = db.doc(`users/${userId}`);
        const userSnap = await userRef.get();
        if (!userSnap.exists || userSnap.data()?.accountId !== accountId) {
             throw new Error("Usuário não encontrado ou não pertence a esta conta.");
        }

        const validatedPermissions = PermissionsSchema.parse(permissions);

        await userRef.update({ permissions: validatedPermissions });
        revalidatePath('/team');
        return { message: 'success' };
    } catch(e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }
}

export async function removeTeamMemberAction(accountId: string, userId: string) {
    try {
        const db = getFirestore();
        const userRef = db.doc(`users/${userId}`);
        const userSnap = await userRef.get();
        if (!userSnap.exists || userSnap.data()?.accountId !== accountId) {
             throw new Error("Usuário não encontrado ou não pertence a esta conta.");
        }
        
        const accountRef = db.doc(`accounts/${accountId}`);
        await accountRef.update({
            members: FieldValue.arrayRemove(userId)
        });

        // We should delete the user document first before deleting the auth user
        await userRef.delete();
        await adminAuth.deleteUser(userId);

        revalidatePath('/team');
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
    const clientsCollection = getFirestore().collection(`accounts/${accountId}/clients`);
    await clientsCollection.add({
      ...validatedFields.data,
      accountId,
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
        const clientDoc = getFirestore().doc(`accounts/${accountId}/clients/${id}`);
        await clientDoc.update({
          ...clientData,
          accountId,
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
    await getFirestore().doc(`accounts/${accountId}/clients/${clientId}`).delete();
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
    const dumpstersCollection = getFirestore().collection(`accounts/${accountId}/dumpsters`);
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
    const dumpsterDoc = getFirestore().doc(`accounts/${accountId}/dumpsters/${id}`);
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
    await getFirestore().doc(`accounts/${accountId}/dumpsters/${dumpsterId}`).delete();
    revalidatePath('/dumpsters');
    revalidatePath('/');
    return { message: 'success' };
  } catch (e) {
    return { message: 'error', error: handleFirebaseError(e) };
  }
}

export async function updateDumpsterStatusAction(accountId: string, dumpsterId: string, newStatus: 'Disponível' | 'Em Manutenção') {
    try {
        const dumpsterRef = getFirestore().doc(`accounts/${accountId}/dumpsters/${dumpsterId}`);
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
    
    await getFirestore().collection(`accounts/${accountId}/rentals`).add({
      ...rentalData,
      accountId,
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
    
    const db = getFirestore();
    const batch = db.batch();
    
    try {
        const rentalRef = db.doc(`accounts/${accountId}/rentals/${rentalId}`);
        const rentalSnap = await rentalRef.get();
        
        if (!rentalSnap.exists) {
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
            totalValue,
            accountId, 
        };
        
        const newCompletedRentalRef = db.collection(`accounts/${accountId}/completed_rentals`).doc();
        batch.set(newCompletedRentalRef, completedRentalData);

        batch.delete(rentalRef);
        
        await batch.commit();

        revalidatePath('/');
        
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
        await getFirestore().doc(`accounts/${accountId}/rentals/${rentalId}`).delete();
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
    
    // Remove undefined fields to prevent Firestore errors
    const updateData = Object.fromEntries(Object.entries(rentalData).filter(([_, v]) => v !== undefined));

    if (Object.keys(updateData).length === 0) {
        return { message: 'success', info: 'Nenhum campo para atualizar.' };
    }

    try {
        const rentalDoc = getFirestore().doc(`accounts/${accountId}/rentals/${id}`);
        await rentalDoc.update({
          ...updateData,
          updatedAt: FieldValue.serverTimestamp(),
        });
        revalidatePath('/');
        return { message: 'success' };
    } catch (e) {
        return { message: 'error', error: handleFirebaseError(e) as string };
    }
}


// #endregion

// #region Finance Actions
export async function updateRentalPricesAction(accountId: string, prevState: any, formData: FormData) {
    const data = JSON.parse(formData.get('rentalPrices') as string);
    const validatedFields = RentalPricesSchema.safeParse({ rentalPrices: data });
    
    if (!validatedFields.success) {
        return {
            error: validatedFields.error.flatten().fieldErrors,
        };
    }

    try {
        const accountRef = getFirestore().doc(`accounts/${accountId}`);
        await accountRef.update({
            rentalPrices: validatedFields.data.rentalPrices ?? []
        });
        revalidatePath('/finance');
        return { message: 'success' };
    } catch (e) {
        return { error: handleFirebaseError(e) };
    }
}

export async function resetFinancialDataAction(accountId: string) {
    if (!accountId) {
        return { message: 'error', error: 'Conta não identificada.' };
    }

    try {
        const db = getFirestore();
        const rentalsCollection = db.collection(`accounts/${accountId}/completed_rentals`);
        const snapshot = await rentalsCollection.get();

        if (snapshot.empty) {
            return { message: 'success', info: 'Nenhum dado financeiro para zerar.' };
        }

        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();

        revalidatePath('/finance');
        return { message: 'success' };
    } catch (e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }
}
// #endregion
