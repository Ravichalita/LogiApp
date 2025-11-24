

'use server';
import { getStorage } from 'firebase-admin/storage';
import { headers } from 'next/headers';
import { google } from 'googleapis';
import { getPopulatedRentalsForServer, getPopulatedOperationsForServer } from './data-server-actions';
import {
    adminAuth,
    adminDb
} from './firebase-admin';
import {
    z
} from 'zod';
import {
    revalidatePath
} from 'next/cache';
import {
    redirect
} from 'next/navigation';
import {
    ClientSchema,
    DumpsterSchema,
    RentalSchema,
    CompletedRentalSchema,
    UpdateClientSchema,
    UpdateDumpsterSchema,
    UpdateRentalSchema,
    SignupSchema,
    UserAccountSchema,
    PermissionsSchema,
    RentalPriceSchema,
    UpdateBackupSettingsSchema,
    UpdateUserProfileSchema,
    AttachmentSchema,
    SuperAdminCreationSchema,
    TruckSchema,
    UpdateTruckSchema,
    OperationSchema,
    UpdateOperationSchema,
    RecurrenceProfileSchema,
    UpdateBasesSchema,
    UpdateOperationalCostsSchema
} from './types';
import type {
    UserAccount,
    UserRole,
    UserStatus,
    Permissions,
    Account,
    RentalPrice,
    UploadedImage,
    Rental,
    AdditionalCost,
    Operation,
    TruckType,
    RecurrenceProfile,
    PopulatedRental,
    PopulatedOperation,
    Dumpster
} from './types';
import {
    ensureUserDocument
} from './data-server';
import {
    sendNotification
} from './notifications';
import {
    addDays,
    isBefore,
    isAfter,
    isToday,
    parseISO,
    startOfToday,
    format,
    set,
    getDay,
    setHours,
    setMinutes,
    setSeconds,
    setMilliseconds
} from 'date-fns';
import {
    toZonedTime
} from 'date-fns-tz';
import {
    FieldValue
} from 'firebase-admin/firestore';

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
        return {
            message: 'success'
        };
    } catch (e) {
        return {
            message: 'error',
            error: handleFirebaseError(e)
        };
    }
}

export async function signupAction(inviterAccountId: string | null, prevState: any, formData: FormData) {
    const isInvite = !!inviterAccountId;

    const validatedFields = SignupSchema.safeParse(Object.fromEntries(formData.entries()));

    if (!validatedFields.success) {
        const fieldErrors = validatedFields.error.flatten().fieldErrors;
        if (fieldErrors._errors && fieldErrors._errors.length > 0) {
            return { ...prevState,
                message: fieldErrors._errors[0]
            };
        }
        const firstError = Object.values(fieldErrors).flat()[0] || 'Por favor, verifique os campos.';
        return { ...prevState,
            message: firstError
        };
    }

    const {
        name,
        email,
        password
    } = validatedFields.data;

    try {
        await ensureUserDocument({
            name,
            email,
            password
        }, inviterAccountId);

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
        return { ...prevState,
            message: handleFirebaseError(e)
        };
    }
}

export async function updateUserRoleAction(invokerId: string, accountId: string, userId: string, newRole: UserRole) {
    try {
        const db = adminDb;

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

        const updates: {
            role: UserRole,
            permissions?: Permissions
        } = {
            role: newRole
        };

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

        await adminAuth.setCustomUserClaims(userId, {
            role: newRole,
            accountId
        });
        await userRef.update(updates);

        revalidatePath('/team');
        return {
            message: 'success'
        };
    } catch (e) {
        return {
            message: 'error',
            error: handleFirebaseError(e)
        };
    }
}



export async function updateUserPermissionsAction(accountId: string, userId: string, permissions: Permissions) {
    try {
        const db = adminDb;
        const userRef = db.doc(`users/${userId}`);
        const userSnap = await userRef.get();
        if (!userSnap.exists) {
            throw new Error("Usuário não encontrado.");
        }

        const userData = userSnap.data() as UserAccount;
        if (userData.accountId !== accountId) {
            throw new Error("Usuário não pertence a esta conta.");
        }

        const newPermissions = { ...permissions
        };

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
        batch.update(userRef, {
            permissions: validatedPermissions
        });

        // If the user being updated is an owner, cascade permissions to their admins
        if (userData.role === 'owner') {
            const adminsSnap = await db.collection('users')
                .where('accountId', '==', accountId)
                .where('role', '==', 'admin')
                .get();

            adminsSnap.docs.forEach(d => {
                batch.update(d.ref, {
                    permissions: validatedPermissions
                });
            });
        }

        await batch.commit();

        revalidatePath('/team');
        revalidatePath('/admin/clients');
        revalidatePath('/');
        revalidatePath('/settings');
        return {
            message: 'success'
        };
    } catch (e) {
        return {
            message: 'error',
            error: handleFirebaseError(e)
        };
    }
}


export async function removeTeamMemberAction(accountId: string, userId: string) {
    const db = adminDb;
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
                batch.update(doc.ref, {
                    assignedTo: ownerId
                });
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
        return {
            message: 'success'
        };
    } catch (e) {
        return {
            message: 'error',
            error: handleFirebaseError(e)
        };
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
        const clientsCollection = adminDb.collection(`accounts/${accountId}/clients`);
        await clientsCollection.add({
            ...validatedFields.data,
            accountId,
            createdAt: FieldValue.serverTimestamp(),
        });
    } catch (e) {
        return {
            message: 'error',
            error: handleFirebaseError(e)
        };
    }

    revalidatePath('/clients');
    redirect('/clients');
}

export async function updateClient(accountId: string, prevState: any, formData: FormData) {
    const rawData = Object.fromEntries(formData.entries());
    const id = rawData.id as string;
    if (!id) {
        return {
            message: 'error',
            error: 'ID do cliente ausente.'
        };
    }

    const validatedFields = UpdateClientSchema.safeParse(rawData);

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'error',
        };
    }

    try {
        const clientDoc = adminDb.doc(`accounts/${accountId}/clients/${id}`);

        // This is the corrected block
        const {
            id: _, ...clientData
        } = validatedFields.data;
        const updateData: Record < string, any > = Object.fromEntries(
            Object.entries(clientData).filter(([_, v]) => v !== undefined && v !== null)
        );
        updateData.updatedAt = FieldValue.serverTimestamp();

        if (formData.has('googleMapsLink')) {
            const rawLink = (formData.get('googleMapsLink') ?? '') as string;
            const linkValue = rawLink.trim();
            if (linkValue === '') {
                // Em vez de salvar uma string vazia, instruímos o Firestore a deletar o campo.
                updateData.googleMapsLink = FieldValue.delete();
            } else {
                updateData.googleMapsLink = linkValue;
            }
        }

        await clientDoc.update(updateData);
        revalidatePath('/clients');
    } catch (e) {
        return {
            message: 'error',
            error: handleFirebaseError(e)
        };
    }

    redirect('/clients');
}


export async function deleteClientAction(accountId: string, clientId: string) {
    const db = adminDb;
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
        return {
            message: 'success'
        };
    } catch (e) {
        return {
            message: 'error',
            error: handleFirebaseError(e)
        };
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
        const dumpstersCollection = adminDb.collection(`accounts/${accountId}/dumpsters`);
        await dumpstersCollection.add({
            ...validatedFields.data,
            accountId,
            createdAt: FieldValue.serverTimestamp(),
        });
        revalidatePath('/dumpsters');
        return {
            message: 'success'
        };
    } catch (e) {
        return {
            message: 'error',
            error: handleFirebaseError(e)
        };
    }
}

export async function updateUserProfileAction(userId: string, prevState: any, formData: FormData) {
    const validatedFields = UpdateUserProfileSchema.safeParse(Object.fromEntries(formData.entries()));

    if (!validatedFields.success) {
        return {
            message: 'error',
            error: JSON.stringify(validatedFields.error.flatten().fieldErrors)
        };
    }

    const { ...updateData
    } = validatedFields.data;

    try {
        const userRef = adminDb.doc(`users/${userId}`);
        await userRef.update({
            ...updateData,
            updatedAt: FieldValue.serverTimestamp(),
        });

        if (validatedFields.data.name) {
            await adminAuth.updateUser(userId, {
                displayName: validatedFields.data.name
            });
        }
        if (validatedFields.data.avatarUrl) {
            await adminAuth.updateUser(userId, {
                photoURL: validatedFields.data.avatarUrl
            });
        }

        revalidatePath('/account');
        return {
            message: 'success'
        };
    } catch (e) {
        return {
            message: 'error',
            error: handleFirebaseError(e)
        };
    }
}

export async function deleteSelfUserAction(accountId: string, userId: string) {
    if (!accountId || !userId) {
        return {
            message: 'error',
            error: "Informações do usuário ausentes."
        };
    }
    const db = adminDb;
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
                batch.update(doc.ref, {
                    assignedTo: FieldValue.delete()
                });
            });
        }

        const createdRentalsQuery = rentalsRef.where('createdBy', '==', userId);
        const createdRentalsSnap = await createdRentalsQuery.get();
        if (!createdRentalsSnap.empty) {
            createdRentalsSnap.forEach(doc => {
                batch.update(doc.ref, {
                    createdBy: FieldValue.delete()
                });
            });
        }

        const accountRef = db.doc(`accounts/${accountId}`);
        batch.update(accountRef, {
            members: FieldValue.arrayRemove(userId)
        });

        batch.delete(userRef);
        await batch.commit();

        await adminAuth.deleteUser(userId);

        return {
            message: 'success'
        };
    } catch (e) {
        return {
            message: 'error',
            error: handleFirebaseError(e)
        };
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

    const {
        id,
        ...dumpsterData
    } = validatedFields.data;

    try {
        const dumpsterDoc = adminDb.doc(`accounts/${accountId}/dumpsters/${id}`);
        await dumpsterDoc.update({
            ...dumpsterData,
            accountId,
            updatedAt: FieldValue.serverTimestamp(),
        });
        revalidatePath('/dumpsters');
        revalidatePath('/');
        return {
            message: 'success'
        };
    } catch (e) {
        return {
            message: 'error',
            error: handleFirebaseError(e)
        };
    }
}

export async function deleteDumpsterAction(accountId: string, dumpsterId: string) {
    try {
        await adminDb.doc(`accounts/${accountId}/dumpsters/${dumpsterId}`).delete();
        revalidatePath('/dumpsters');
        revalidatePath('/');
        return {
            message: 'success'
        };
    } catch (e) {
        return {
            message: 'error',
            error: handleFirebaseError(e)
        };
    }
}

export async function updateDumpsterStatusAction(accountId: string, dumpsterId: string, newStatus: 'Disponível' | 'Em Manutenção') {
    try {
        const dumpsterRef = adminDb.doc(`accounts/${accountId}/dumpsters/${dumpsterId}`);
        await dumpsterRef.update({
            status: newStatus
        });
        revalidatePath('/dumpsters');
        revalidatePath('/');
        return {
            message: 'success'
        };
    } catch (e) {
        return {
            message: 'error',
            error: handleFirebaseError(e)
        };
    }
}


// #endregion

// #region Rental Actions

// Helper function to calculate the next run date for a recurrence profile
function calculateNextRunDate(daysOfWeek: number[], time: string): Date {
    const [hours, minutes] = time.split(':').map(Number);
    const now = new Date();
    const todayIndex = getDay(now);

    const sortedDays = [...daysOfWeek].sort((a, b) => a - b);

    let nextDayIndex = sortedDays.find((day) => day > todayIndex);

    if (nextDayIndex === undefined) {
        nextDayIndex = sortedDays[0];
    }

    let nextDate = new Date();
    if (nextDayIndex > todayIndex) {
        nextDate = addDays(now, nextDayIndex - todayIndex);
    } else {
        nextDate = addDays(now, 7 - (todayIndex - nextDayIndex));
    }

    nextDate = setHours(nextDate, hours);
    nextDate = setMinutes(nextDate, minutes);
    nextDate = setSeconds(nextDate, 0);
    nextDate = setMilliseconds(nextDate, 0);

    return nextDate;
}


export async function createRental(accountId: string, createdBy: string, prevState: any, formData: FormData) {
    const db = adminDb;
    const accountRef = db.doc(`accounts/${accountId}`);
    let rentalDocRef;

    try {
        const newSequentialId = await db.runTransaction(async (transaction) => {
            const accountSnap = await transaction.get(accountRef);
            if (!accountSnap.exists) {
                throw new Error("Conta não encontrada.");
            }
            const currentCounter = accountSnap.data()?.rentalCounter || 0;
            const newCounter = currentCounter + 1;
            transaction.update(accountRef, {
                rentalCounter: newCounter
            });
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

        let dumpsterIds: string[] = [];
        if (rawData.dumpsterIds && typeof rawData.dumpsterIds === 'string') {
            try {
                dumpsterIds = JSON.parse(rawData.dumpsterIds);
            } catch (e) {
                console.error("Failed to parse dumpsterIds JSON");
                return {
                    message: 'error',
                    error: "Formato de IDs de caçamba inválido."
                }
            }
        }

        let recurrenceProfileId: string | undefined;
        if (rawData.recurrence && typeof rawData.recurrence === 'string') {
            try {
                const recurrenceData = JSON.parse(rawData.recurrence);
                if (recurrenceData.enabled) {
                    const nextRunDate = calculateNextRunDate(recurrenceData.daysOfWeek, recurrenceData.time);

                    const recurrenceProfile: Omit<RecurrenceProfile, 'id' | 'createdAt' | 'originalOrderId'> = {
                        accountId,
                        frequency: recurrenceData.frequency,
                        daysOfWeek: recurrenceData.daysOfWeek,
                        time: recurrenceData.time,
                        endDate: recurrenceData.endDate ? new Date(recurrenceData.endDate).toISOString() : undefined,
                        billingType: recurrenceData.billingType,
                        status: 'active',
                        type: 'rental',
                        nextRunDate: nextRunDate.toISOString(),
                        templateData: {} // This will be filled later
                    };
                    
                    const recurrenceRef = await db.collection(`accounts/${accountId}/recurrence_profiles`).add({
                        ...recurrenceProfile,
                        createdAt: FieldValue.serverTimestamp(),
                    });
                    recurrenceProfileId = recurrenceRef.id;

                    await recurrenceRef.update({
                        id: recurrenceProfileId
                    });
                }
            } catch (e) {
                console.error("Failed to parse recurrence JSON or create profile", e);
            }
        }

        const dataToValidate = {
            ...rawData,
            dumpsterIds,
            value: Number(rawData.value),
            lumpSumValue: Number(rawData.lumpSumValue),
            travelCost: Number(rawData.travelCost),
            totalCost: Number(rawData.totalCost),
            accountId,
            sequentialId: newSequentialId,
            status: 'Pendente',
            createdBy: createdBy,
            notificationsSent: {
                due: false,
                late: false
            },
            attachments,
            additionalCosts,
            recurrenceProfileId,
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

        rentalDocRef = await db.collection(`accounts/${accountId}/rentals`).add({
            ...rentalData,
            createdAt: FieldValue.serverTimestamp(),
        });

        // If recurrence was created, update it with the original order details
        if (recurrenceProfileId) {
            const recurrenceRef = db.doc(`accounts/${accountId}/recurrence_profiles/${recurrenceProfileId}`);
            await recurrenceRef.update({
                originalOrderId: rentalDocRef.id,
                templateData: rentalData // Save the full rental data as a template
            });
        }


        const dumpsterNames = (await Promise.all(
            rentalData.dumpsterIds.map(id => db.doc(`accounts/${accountId}/dumpsters/${id}`).get())
        )).map(doc => doc.data()?.name || 'Caçamba').join(', ');

        await sendNotification({
            userId: rentalData.assignedTo,
            title: `Nova OS #${newSequentialId} Designada`,
            body: `Você foi designado para a OS da(s) caçamba(s): ${dumpsterNames}.`,
        });

        // Sync to Google Calendar if integrated
        try {
            const userDoc = await db.doc(`users/${rentalData.assignedTo}`).get();
            if (userDoc.exists && userDoc.data()?.googleCalendar) {
                // Fetch all data required for the PopulatedRental type
                const clientSnap = await db.doc(`accounts/${accountId}/clients/${rentalData.clientId}`).get();
                const assignedToSnap = await db.doc(`users/${rentalData.assignedTo}`).get();
                const truckSnap = rentalData.truckId ? await db.doc(`accounts/${accountId}/trucks/${rentalData.truckId}`).get() : null;

                const dumpsterDocs = await Promise.all(rentalData.dumpsterIds.map(id => db.doc(`accounts/${accountId}/dumpsters/${id}`).get()));
                const dumpsters = dumpsterDocs.map(d => ({
                    id: d.id,
                    ...d.data()
                }) as Dumpster);

                const populatedRentalForSync: PopulatedRental = {
                    id: rentalDocRef.id,
                    ...rentalData,
                    itemType: 'rental',
                    client: clientSnap.exists ? {
                        id: clientSnap.id,
                        ...clientSnap.data()
                    } as any : null,
                    dumpsters,
                    assignedToUser: assignedToSnap.exists ? {
                        id: assignedToSnap.id,
                        ...assignedToSnap.data()
                    } as any : null,
                    truck: truckSnap && truckSnap.exists ? {
                        id: truckSnap.id,
                        ...truckSnap.data()
                    } as any : null,
                };
                await syncOsToGoogleCalendarAction(rentalData.assignedTo, populatedRentalForSync);
            }
        } catch (syncError: any) {
            console.error('ERRO DETALHADO DA SINCRONIZAÇÃO:', JSON.stringify(syncError, null, 2));
            return {
                message: 'error',
                error: syncError.message || 'Falha ao sincronizar com Google Agenda.'
            };
        }


        const swapOriginId = formData.get('swapOriginId') as string | null;
        if (swapOriginId) {
            await finishRentalAction(accountId, swapOriginId);
        }

    } catch (e) {
        return {
            message: handleFirebaseError(e) as string
        };
    }

    revalidatePath('/os');
    redirect('/os');
}

export async function finishRentalAction(accountId: string, rentalId: string) {
    if (!rentalId || !accountId) {
        return {
            message: 'error',
            error: 'ID da OS ou da conta está ausente.'
        };
    }

    const db = adminDb;
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
        const assignedToSnap = await db.doc(`users/${rentalData.assignedTo}`).get();

        const dumpsterDocs = await Promise.all(
            (rentalData.dumpsterIds || []).map(id => db.doc(`accounts/${accountId}/dumpsters/${id}`).get())
        );
        const dumpsters = dumpsterDocs.map(d => ({
            id: d.id,
            ...d.data()
        }) as Dumpster);

        const rentalDate = new Date(rentalData.rentalDate);
        const returnDate = new Date(rentalData.returnDate);
        const diffTime = Math.abs(returnDate.getTime() - rentalDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const rentalDays = Math.max(diffDays, 1);
        const totalValue = rentalData.billingType === 'lumpSum' ? (rentalData.lumpSumValue || 0) : rentalData.value * rentalDays * rentalData.dumpsterIds.length;

        const completedRentalData = {
            ...rentalData,
            originalRentalId: rentalId,
            completedDate: FieldValue.serverTimestamp(),
            rentalDays,
            totalValue,
            accountId,
            // Store denormalized data for historical integrity
            client: clientSnap.exists ? clientSnap.data() : null,
            dumpsters: dumpsters,
            assignedToUser: assignedToSnap.exists ? assignedToSnap.data() : null,
        };

        const newCompletedRentalRef = db.collection(`accounts/${accountId}/completed_rentals`).doc();
        batch.set(newCompletedRentalRef, completedRentalData);

        batch.delete(rentalRef);

        await batch.commit();

    } catch (e) {
        console.error("Failed to finish rental:", e);
        return {
            message: 'error',
            error: handleFirebaseError(e)
        };
    }

    revalidatePath('/');
    revalidatePath('/finance');
}

export async function deleteRentalAction(accountId: string, rentalId: string) {
    if (!rentalId) {
        return {
            message: 'error',
            error: 'Rental ID is missing.'
        };
    }
    const db = adminDb;
    try {
        const rentalRef = db.doc(`accounts/${accountId}/rentals/${rentalId}`);
        const rentalSnap = await rentalRef.get();
        if (rentalSnap.exists) {
            const rentalData = rentalSnap.data() as Rental;
            if (rentalData.attachments && rentalData.attachments.length > 0) {
                for (const attachment of rentalData.attachments) {
                    await deleteStorageFileAction(attachment.path);
                }
            }
        }
        await rentalRef.delete();
        revalidatePath('/');
        return {
            message: 'success'
        };
    } catch (e) {
        return {
            message: 'error',
            error: handleFirebaseError(e) as string
        };
    }
}

export async function updateRentalAction(accountId: string, prevState: any, formData: FormData) {
    const rawData = Object.fromEntries(formData.entries());
    const dataToValidate: Record < string, any > = { ...rawData
    };

    if (rawData.dumpsterIds && typeof rawData.dumpsterIds === 'string') {
        try {
            dataToValidate.dumpsterIds = JSON.parse(rawData.dumpsterIds);
        } catch (e) {
            return {
                message: 'error',
                error: "Formato de IDs de caçamba inválido."
            }
        }
    }

    if (rawData.value !== undefined) {
        dataToValidate.value = Number(rawData.value);
    }

    if (rawData.attachments && typeof rawData.attachments === 'string') {
        try {
            dataToValidate.attachments = JSON.parse(rawData.attachments);
        } catch (e) {
            return {
                message: 'error',
                error: "Formato de anexos inválido."
            };
        }
    }

    if (rawData.additionalCosts && typeof rawData.additionalCosts === 'string') {
        try {
            dataToValidate.additionalCosts = JSON.parse(rawData.additionalCosts);
        } catch (e) {
            return {
                message: 'error',
                error: "Formato de custos adicionais inválido."
            }
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

    const {
        id,
        ...rentalData
    } = validatedFields.data;

    const updateData: Record < string, any > = Object.fromEntries(Object.entries(rentalData).filter(([_, v]) => v !== undefined && v !== null));

    if (formData.has('deliveryGoogleMapsLink')) {
        const linkValue = formData.get('deliveryGoogleMapsLink') as string;
        updateData.deliveryGoogleMapsLink = linkValue && linkValue.trim() !== '' ? linkValue : FieldValue.delete();
    }

    if (updateData.swapDate === null) {
        updateData.swapDate = FieldValue.delete();
    }

    if (Object.keys(updateData).length === 0) {
        return {
            message: 'success',
            info: 'Nenhum campo para atualizar.'
        };
    }

    try {
        const rentalRef = adminDb.doc(`accounts/${accountId}/rentals/${id}`);

        const rentalBeforeUpdateSnap = await rentalRef.get();
        if (!rentalBeforeUpdateSnap.exists) throw new Error("OS não encontrada.");
        const rentalBeforeUpdate = rentalBeforeUpdateSnap.data() as Rental;

        await rentalRef.update({
            ...updateData,
            updatedAt: FieldValue.serverTimestamp(),
        });

        const updatedRentalData = { ...rentalBeforeUpdate,
            ...updateData
        };

        const fullUpdatedRental: PopulatedRental = {
            id,
            itemType: 'rental',
            ...updatedRentalData,
            client: (await adminDb.doc(`accounts/${accountId}/clients/${updatedRentalData.clientId}`).get()).data() as any,
            dumpsters: await Promise.all((updatedRentalData.dumpsterIds || []).map(async dId => (await adminDb.doc(`accounts/${accountId}/dumpsters/${dId}`).get()).data() as any)),
            assignedToUser: (await adminDb.doc(`users/${updatedRentalData.assignedTo}`).get()).data() as any,
            truck: updatedRentalData.truckId ? (await adminDb.doc(`accounts/${accountId}/trucks/${updatedRentalData.truckId}`).get()).data() as any : null,
        };

        if (updateData.assignedTo && updateData.assignedTo !== rentalBeforeUpdate.assignedTo) {
            await sendNotification({
                userId: updateData.assignedTo,
                title: 'Você foi designado para uma OS',
                body: `Você agora é o responsável pela OS para ${fullUpdatedRental.client?.name}.`,
            });
        }

        // Always sync calendar on any relevant update
        if (updatedRentalData.assignedTo) {
            await syncOsToGoogleCalendarAction(updatedRentalData.assignedTo, fullUpdatedRental);
        }

        revalidatePath('/os');
    } catch (e) {
        return {
            message: 'error',
            error: handleFirebaseError(e) as string
        };
    }

    // Only redirect if coming from the edit page, not from a simple attachment update
    const headersList = headers();
    const referer = headersList.get('referer');
    if (referer?.includes('/edit')) {
        redirect('/os');
    }
}

export async function addAttachmentToRentalAction(accountId: string, rentalId: string, attachment: z.infer < typeof AttachmentSchema > , collectionName: 'rentals' | 'completed_rentals') {
    if (!accountId || !rentalId) return {
        message: 'error',
        error: 'ID da conta ou do aluguel ausente.'
    };

    try {
        const rentalRef = adminDb.doc(`accounts/${accountId}/${collectionName}/${rentalId}`);
        await rentalRef.update({
            attachments: FieldValue.arrayUnion(attachment)
        });
        revalidatePath(collectionName === 'rentals' ? '/os' : '/finance');
        return {
            message: 'success'
        };
    } catch (e) {
        return {
            message: 'error',
            error: handleFirebaseError(e)
        };
    }
}

export async function addAttachmentToOperationAction(accountId: string, operationId: string, attachment: z.infer < typeof AttachmentSchema > , collectionName: 'operations' | 'completed_operations') {
    if (!accountId || !operationId) return {
        message: 'error',
        error: 'ID da conta ou da operação ausente.'
    };
    try {
        const opRef = adminDb.doc(`accounts/${accountId}/${collectionName}/${operationId}`);
        await opRef.update({
            attachments: FieldValue.arrayUnion(attachment)
        });
        revalidatePath(collectionName === 'operations' ? '/os' : '/finance');
        return {
            message: 'success'
        };
    } catch (e) {
        return {
            message: 'error',
            error: handleFirebaseError(e)
        };
    }
}

export async function deleteAttachmentAction(accountId: string, itemId: string, itemKind: 'rentals' | 'operations' | 'completed_rentals' | 'completed_operations', attachment: Attachment) {
    if (!accountId || !itemId || !itemKind) return {
        message: 'error',
        error: 'Informações incompletas para excluir anexo.'
    };

    try {
        await deleteStorageFileAction(attachment.path);

        const itemRef = adminDb.doc(`accounts/${accountId}/${itemKind}/${itemId}`);
        await itemRef.update({
            attachments: FieldValue.arrayRemove(attachment)
        });

        revalidatePath('/os');
        revalidatePath('/finance');
        return {
            message: 'success'
        };
    } catch (e) {
        console.error("Error deleting attachment reference from DB:", e);
        return {
            message: 'error',
            error: handleFirebaseError(e)
        };
    }
}


// #endregion

// #region Operation Actions

export async function createOperationAction(accountId: string, createdBy: string, prevState: any, formData: FormData) {
    const db = adminDb;
    const accountRef = db.doc(`accounts/${accountId}`);
    let opDocRef;

    try {
        const newSequentialId = await db.runTransaction(async (transaction) => {
            const accountSnap = await transaction.get(accountRef);
            if (!accountSnap.exists) {
                throw new Error("Conta não encontrada.");
            }
            const currentCounter = accountSnap.data()?.operationCounter || 0;
            const newCounter = currentCounter + 1;
            transaction.update(accountRef, {
                operationCounter: newCounter
            });
            return newCounter;
        });

        const rawData = Object.fromEntries(formData.entries());

        const rawValue = rawData.value as string;

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

        let recurrenceProfileId: string | undefined;
        if (rawData.recurrence && typeof rawData.recurrence === 'string') {
            try {
                const recurrenceData = JSON.parse(rawData.recurrence);
                if (recurrenceData.enabled) {
                    const nextRunDate = calculateNextRunDate(recurrenceData.daysOfWeek, recurrenceData.time);

                    const recurrenceProfile: Omit<RecurrenceProfile, 'id' | 'createdAt' | 'originalOrderId'> = {
                        accountId,
                        frequency: recurrenceData.frequency,
                        daysOfWeek: recurrenceData.daysOfWeek,
                        time: recurrenceData.time,
                        endDate: recurrenceData.endDate ? new Date(recurrenceData.endDate).toISOString() : undefined,
                        billingType: recurrenceData.billingType,
                        status: 'active',
                        type: 'operation',
                        nextRunDate: nextRunDate.toISOString(),
                        templateData: {} // Will be filled later
                    };

                    const recurrenceRef = await db.collection(`accounts/${accountId}/recurrence_profiles`).add({
                        ...recurrenceProfile,
                        createdAt: FieldValue.serverTimestamp(),
                    });
                    recurrenceProfileId = recurrenceRef.id;

                    await recurrenceRef.update({
                        id: recurrenceProfileId
                    });
                }
            } catch (e) {
                console.error("Failed to parse recurrence JSON or create profile", e);
            }
        }


        const dataToValidate = {
            ...rawData,
            value: Number(rawValue),
            travelCost: Number(rawData.travelCost),
            totalCost: Number(rawData.totalCost),
            createdBy: createdBy,
            accountId: accountId,
            typeIds,
            sequentialId: newSequentialId,
            status: 'Pendente',
            recurrenceProfileId,
            attachments,
            additionalCosts
        };

        const validatedFields = OperationSchema.safeParse(dataToValidate);

        if (!validatedFields.success) {
            return {
                errors: validatedFields.error.flatten().fieldErrors,
                message: 'error',
            };
        }

        const { ...operationData
        } = validatedFields.data;

        const finalData = Object.fromEntries(Object.entries(operationData).filter(([_, v]) => v !== undefined));

        opDocRef = await db.collection(`accounts/${accountId}/operations`).add({
            ...finalData,
            createdAt: FieldValue.serverTimestamp(),
        });
        
         if (recurrenceProfileId) {
            const recurrenceRef = db.doc(`accounts/${accountId}/recurrence_profiles/${recurrenceProfileId}`);
            await recurrenceRef.update({ 
                originalOrderId: opDocRef.id,
                templateData: finalData
            });
        }


        if (operationData.truckId) {
            await db.doc(`accounts/${accountId}/trucks/${operationData.truckId}`).update({
                status: 'Em Operação'
            });
        }

        if (validatedFields.data.driverId) {
            await sendNotification({
                userId: validatedFields.data.driverId,
                title: `Nova Operação #${newSequentialId} Designada`,
                body: `Você foi designado para uma operação.`,
            });
        }

        // Sync to Google Calendar if integrated
        try {
            const userDoc = await db.doc(`users/${operationData.driverId}`).get();
            if (userDoc.exists && userDoc.data()?.googleCalendar) {
                const clientSnap = await db.doc(`accounts/${accountId}/clients/${operationData.clientId}`).get();
                const driverSnap = await db.doc(`users/${operationData.driverId}`).get();
                const truckSnap = operationData.truckId ? await db.doc(`accounts/${accountId}/trucks/${operationData.truckId}`).get() : null;

                const accountSnap = await accountRef.get();
                const operationTypes: OperationType[] = accountSnap.data()?.operationTypes || [];
                const opTypeMap = new Map(operationTypes.map(t => [t.id, t.name]));

                const populatedOpForSync: PopulatedOperation = {
                    id: opDocRef.id,
                    ...operationData,
                    itemType: 'operation',
                    client: clientSnap.exists ? {
                        id: clientSnap.id,
                        ...clientSnap.data()
                    } as any : null,
                    driver: driverSnap.exists ? {
                        id: driverSnap.id,
                        ...driverSnap.data()
                    } as any : null,
                    truck: truckSnap && truckSnap.exists ? {
                        id: truckSnap.id,
                        ...truckSnap.data()
                    } as any : null,
                    operationTypes: (operationData.typeIds || []).map(id => ({
                        id,
                        name: opTypeMap.get(id) || 'Tipo desconhecido'
                    })),
                };
                await syncOsToGoogleCalendarAction(operationData.driverId, populatedOpForSync);
            }
        } catch (syncError: any) {
            console.error('ERRO DETALHADO DA SINCRONIZAÇÃO:', JSON.stringify(syncError, null, 2));
            return {
                message: 'error',
                error: syncError.message || 'Falha ao sincronizar com Google Agenda.'
            };
        }


    } catch (e) {
        return {
            message: 'error',
            error: handleFirebaseError(e) as string
        };
    }

    revalidatePath('/os');
    redirect('/os');
}

export async function updateOperationAction(accountId: string, prevState: any, formData: FormData) {
    const rawData = Object.fromEntries(formData.entries());
    const dataToValidate: Record < string, any > = { ...rawData
    };

    if (rawData.additionalCosts && typeof rawData.additionalCosts === 'string') {
        try {
            dataToValidate.additionalCosts = JSON.parse(rawData.additionalCosts);
        } catch (e) {
            return {
                message: 'error',
                error: "Formato de custos adicionais inválido."
            }
        }
    }

    if (rawData.typeIds && typeof rawData.typeIds === 'string') {
        try {
            dataToValidate.typeIds = JSON.parse(rawData.typeIds);
        } catch (e) {
            return {
                message: 'error',
                error: "Formato de tipos de operação inválido."
            }
        }
    }

    if (rawData.attachments && typeof rawData.attachments === 'string') {
        try {
            dataToValidate.attachments = JSON.parse(rawData.attachments);
        } catch (e) {
            return {
                message: 'error',
                error: "Formato de anexos inválido."
            }
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

    const {
        id,
        ...operationData
    } = validatedFields.data;
    const updateData: Record < string, any > = Object.fromEntries(Object.entries(operationData).filter(([_, v]) => v !== undefined && v !== null));

    if (formData.has('destinationGoogleMapsLink')) {
        const linkValue = formData.get('destinationGoogleMapsLink') as string;
        updateData.destinationGoogleMapsLink = linkValue && linkValue.trim() !== '' ? linkValue : FieldValue.delete();
    }

    if (Object.keys(updateData).length === 0) {
        return {
            message: 'success',
            info: 'Nenhum campo para atualizar.'
        };
    }

    try {
        const operationRef = adminDb.doc(`accounts/${accountId}/operations/${id}`);
        const opBeforeUpdateSnap = await operationRef.get();
        if (!opBeforeUpdateSnap.exists) throw new Error("Operação não encontrada.");
        const opBeforeUpdate = opBeforeUpdateSnap.data() as Operation;

        await operationRef.update({
            ...updateData,
            updatedAt: FieldValue.serverTimestamp(),
        });

        if (updateData.driverId && updateData.driverId !== opBeforeUpdate.driverId) {
            await sendNotification({
                userId: updateData.driverId,
                title: 'Você foi designado para uma Operação',
                body: `Você foi designado para uma nova operação. Verifique os detalhes no app.`,
            });

            // Sync to Google Calendar
            try {
                const userDoc = await adminDb.doc(`users/${updateData.driverId}`).get();
                if (userDoc.exists && userDoc.data()?.googleCalendar) {

                    const updatedOpData = { ...opBeforeUpdate,
                        ...updateData
                    };

                    const clientSnap = await adminDb.doc(`accounts/${accountId}/clients/${updatedOpData.clientId}`).get();
                    const driverSnap = userDoc;
                    const truckSnap = updatedOpData.truckId ? await adminDb.doc(`accounts/${accountId}/trucks/${updatedOpData.truckId}`).get() : null;

                    const accountSnap = await adminDb.doc(`accounts/${accountId}`).get();
                    const operationTypes: OperationType[] = accountSnap.data()?.operationTypes || [];
                    const opTypeMap = new Map(operationTypes.map(t => [t.id, t.name]));

                    const populatedOpForSync: PopulatedOperation = {
                        id,
                        ...updatedOpData,
                        itemType: 'operation',
                        client: clientSnap.exists ? {
                            id: clientSnap.id,
                            ...clientSnap.data()
                        } as any : null,
                        driver: driverSnap.exists ? {
                            id: driverSnap.id,
                            ...driverSnap.data()
                        } as any : null,
                        truck: truckSnap && truckSnap.exists ? {
                            id: truckSnap.id,
                            ...truckSnap.data()
                        } as any : null,
                        operationTypes: (updatedOpData.typeIds || []).map(typeId => ({
                            id: typeId,
                            name: opTypeMap.get(typeId) || 'Tipo desconhecido'
                        })),
                    };

                    await syncOsToGoogleCalendarAction(updateData.driverId, populatedOpForSync);
                }
            } catch (syncError: any) {
                console.error(`Falha ao sincronizar a atualização da Operação ${id} com o Google Agenda:`, syncError.message);
            }
        }

        revalidatePath('/operations');
        revalidatePath('/os');
    } catch (e) {
        return {
            message: 'error',
            error: handleFirebaseError(e)
        };
    }

    // Only redirect if coming from the edit page
    const headersList = headers();
    const referer = headersList.get('referer');
    if (referer?.includes('/edit')) {
        redirect('/os');
    }
}


export async function finishOperationAction(accountId: string, operationId: string) {
    if (!accountId || !operationId) {
        return {
            message: 'error',
            error: 'ID da conta ou da operação está ausente.'
        };
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
            batch.update(truckRef, {
                status: 'Disponível'
            });
        }

        await batch.commit();

        revalidatePath('/operations');
        revalidatePath('/finance');
        revalidatePath('/os');
        revalidatePath('/fleet');
        return {
            message: 'success'
        };
    } catch (e) {
        return {
            message: 'error',
            error: handleFirebaseError(e)
        };
    }
}

export async function deleteOperationAction(accountId: string, operationId: string) {
    if (!accountId || !operationId) {
        return {
            message: 'error',
            error: 'ID da conta ou da operação está ausente.'
        };
    }
    const db = adminDb;
    try {
        const opRef = db.doc(`accounts/${accountId}/operations/${operationId}`);
        const opSnap = await opRef.get();
        if (opSnap.exists) {
            const opData = opSnap.data() as Operation;
            if (opData.truckId) {
                const truckRef = db.doc(`accounts/${accountId}/trucks/${opData.truckId}`);
                await truckRef.update({
                    status: 'Disponível'
                });
            }
            if (opData.attachments && opData.attachments.length > 0) {
                for (const attachment of opData.attachments) {
                    await deleteStorageFileAction(attachment.path);
                }
            }
        }
        await opRef.delete();
        revalidatePath('/operations');
        revalidatePath('/os');
        revalidatePath('/fleet');
        return {
            message: 'success'
        };
    } catch (e) {
        return {
            message: 'error',
            error: handleFirebaseError(e)
        };
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
        return {
            message: 'success'
        };
    } catch (e) {
        return {
            message: 'error',
            error: handleFirebaseError(e)
        };
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

    const {
        id,
        ...truckData
    } = validatedFields.data;

    try {
        const truckDoc = adminDb.doc(`accounts/${accountId}/trucks/${id}`);
        await truckDoc.update({
            ...truckData,
            updatedAt: FieldValue.serverTimestamp(),
        });
        revalidatePath('/fleet');
        return {
            message: 'success'
        };
    } catch (e) {
        return {
            message: 'error',
            error: handleFirebaseError(e)
        };
    }
}

export async function deleteTruckAction(accountId: string, truckId: string) {
    try {
        await adminDb.doc(`accounts/${accountId}/trucks/${truckId}`).delete();
        revalidatePath('/fleet');
        return {
            message: 'success'
        };
    } catch (e) {
        return {
            message: 'error',
            error: handleFirebaseError(e)
        };
    }
}

export async function updateTruckStatusAction(accountId: string, truckId: string, newStatus: Truck['status']) {
    try {
        const truckRef = adminDb.doc(`accounts/${accountId}/trucks/${truckId}`);
        await truckRef.update({
            status: newStatus
        });
        revalidatePath('/fleet');
        return {
            message: 'success'
        };
    } catch (e) {
        return {
            message: 'error',
            error: handleFirebaseError(e)
        };
    }
}
// #endregion

// #region Settings & Reset Actions

export async function updateBasesAction(accountId: string, bases: any[]) {
    const validatedFields = UpdateBasesSchema.safeParse({
        bases
    });

    if (!validatedFields.success) {
        console.error("Base validation error:", validatedFields.error.flatten().fieldErrors);
        return {
            message: 'error' as const,
            error: JSON.stringify(validatedFields.error.flatten().fieldErrors),
        };
    }

    try {
        const accountRef = adminDb.doc(`accounts/${accountId}`);
        await accountRef.update({
            bases: validatedFields.data.bases ?? []
        });
        revalidatePath('/settings');
        revalidatePath('/operations/new');
        return {
            message: 'success' as const
        };
    } catch (e) {
        return {
            message: 'error' as const, error: handleFirebaseError(e)
        };
    }
}


export async function updateOperationTypesAction(accountId: string, types: OperationType[]) {
    const validatedFields = z.array(OperationTypeSchema).safeParse(types);

    if (!validatedFields.success) {
        return {
            message: 'error',
            error: "Tipos de operação inválidos."
        };
    }

    try {
        const accountRef = adminDb.doc(`accounts/${accountId}`);
        await accountRef.update({
            operationTypes: validatedFields.data
        });
        revalidatePath('/settings');
        revalidatePath('/operations/new');
        return {
            message: 'success'
        };
    } catch (e) {
        return {
            message: 'error',
            error: handleFirebaseError(e)
        };
    }
}

export async function updateTruckTypesAction(accountId: string, types: TruckType[]) {
    const validatedFields = z.array(TruckTypeSchema).safeParse(types);

    if (!validatedFields.success) {
        return {
            message: 'error',
            error: "Tipos de caminhão inválidos."
        };
    }

    try {
        const accountRef = adminDb.doc(`accounts/${accountId}`);
        await accountRef.update({
            truckTypes: validatedFields.data
        });
        revalidatePath('/fleet');
        return {
            message: 'success'
        };
    } catch (e) {
        return {
            message: 'error',
            error: handleFirebaseError(e)
        };
    }
}


export async function updateOperationalCostsAction(accountId: string, costs: OperationalCost[]) {
    const validatedFields = UpdateOperationalCostsSchema.safeParse({
        operationalCosts: costs
    });

    if (!validatedFields.success) {
        return {
            message: 'error' as const,
            error: "Dados de custo inválidos."
        };
    }

    try {
        const accountRef = adminDb.doc(`accounts/${accountId}`);
        await accountRef.update({
            operationalCosts: validatedFields.data.operationalCosts ?? []
        });
        revalidatePath('/settings');
        return {
            message: 'success' as const
        };
    } catch (e) {
        return {
            message: 'error' as const, error: handleFirebaseError(e)
        };
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
        const accountRef = adminDb.doc(`accounts/${accountId}`);
        await accountRef.update({
            rentalPrices: validatedFields.data ?? []
        });
        revalidatePath('/settings');
        revalidatePath('/rentals/new');
        return {
            message: 'success'
        };
    } catch (e) {
        return {
            message: 'error',
            error: handleFirebaseError(e)
        };
    }
}

async function deleteCollectionByPath(db: FirebaseFirestore.Firestore, collectionPath: string, batchSize: number): Promise < string[] > {
    const collectionRef = db.collection(collectionPath);
    let query = collectionRef.orderBy(FieldValue.documentId()).limit(batchSize);
    let attachmentPaths: string[] = [];

    while (true) {
        const snapshot = await query.get();
        if (snapshot.empty) {
            break;
        }

        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.attachments && Array.isArray(data.attachments)) {
                for (const attachment of data.attachments) {
                    if (attachment.path) {
                        attachmentPaths.push(attachment.path);
                    }
                }
            }
            batch.delete(doc.ref);
        });
        await batch.commit();

        const lastVisible = snapshot.docs[snapshot.docs.length - 1];
        query = collectionRef.orderBy(FieldValue.documentId()).startAfter(lastVisible).limit(batchSize);
    }

    return attachmentPaths;
}


export async function resetCompletedRentalsAction(accountId: string) {
    if (!accountId) return {
        message: 'error',
        error: 'Conta não identificada.'
    };
    try {
        const pathsToDelete = await deleteCollectionByPath(adminDb, `accounts/${accountId}/completed_rentals`, 50);
        for (const path of pathsToDelete) {
            await deleteStorageFileAction(path);
        }
        revalidatePath('/finance');
        return {
            message: 'success'
        };
    } catch (e) {
        return {
            message: 'error',
            error: handleFirebaseError(e)
        };
    }
}

export async function resetCompletedOperationsAction(accountId: string) {
    if (!accountId) return {
        message: 'error',
        error: 'Conta não identificada.'
    };
    try {
        const pathsToDelete = await deleteCollectionByPath(adminDb, `accounts/${accountId}/completed_operations`, 50);
        for (const path of pathsToDelete) {
            await deleteStorageFileAction(path);
        }
        revalidatePath('/finance');
        return {
            message: 'success'
        };
    } catch (e) {
        return {
            message: 'error',
            error: handleFirebaseError(e)
        };
    }
}

export async function resetActiveRentalsAction(accountId: string) {
    if (!accountId) return {
        message: 'error',
        error: 'Conta não identificada.'
    };
    try {
        const pathsToDelete = await deleteCollectionByPath(adminDb, `accounts/${accountId}/rentals`, 50);
        for (const path of pathsToDelete) {
            await deleteStorageFileAction(path);
        }
        revalidatePath('/');
        return {
            message: 'success'
        };
    } catch (e) {
        return {
            message: 'error',
            error: handleFirebaseError(e)
        };
    }
}

export async function resetActiveOperationsAction(accountId: string) {
    if (!accountId) return {
        message: 'error',
        error: 'Conta não identificada.'
    };
    try {
        const pathsToDelete = await deleteCollectionByPath(adminDb, `accounts/${accountId}/operations`, 50);
        for (const path of pathsToDelete) {
            await deleteStorageFileAction(path);
        }
        revalidatePath('/operations');
        return {
            message: 'success'
        };
    } catch (e) {
        return {
            message: 'error',
            error: handleFirebaseError(e)
        };
    }
}

export async function resetAllDataAction(accountId: string) {
    if (!accountId) {
        return {
            message: 'error',
            error: 'Conta não identificada.'
        };
    }
    const db = adminDb;
    try {
        const collectionsToDelete = ['clients', 'dumpsters', 'rentals', 'completed_rentals', 'trucks', 'operations', 'completed_operations'];
        let allAttachmentPaths: string[] = [];

        for (const collection of collectionsToDelete) {
            const paths = await deleteCollectionByPath(db, `accounts/${accountId}/${collection}`, 50);
            allAttachmentPaths = allAttachmentPaths.concat(paths);
        }

        for (const path of allAttachmentPaths) {
            await deleteStorageFileAction(path);
        }

        const accountRef = db.doc(`accounts/${accountId}`);
        await accountRef.update({
            rentalCounter: 0,
            operationCounter: 0,
        });

        revalidatePath('/settings');
        revalidatePath('/');
        return {
            message: 'success'
        };
    } catch (e) {
        console.error("Error in resetAllDataAction (server-side part):", e);
        return {
            message: 'error',
            error: handleFirebaseError(e)
        };
    }
}

// #endregion


// #region Backup Actions

export async function updateBackupSettingsAction(accountId: string, prevState: any, formData: FormData) {
    if (!accountId) return {
        message: 'error',
        error: 'Conta não identificada.'
    };

    const validatedFields = UpdateBackupSettingsSchema.safeParse(Object.fromEntries(formData.entries()));

    if (!validatedFields.success) {
        return {
            message: 'error',
            error: validatedFields.error.flatten().fieldErrors.backupPeriodicityDays?.[0] || validatedFields.error.flatten().fieldErrors.backupRetentionDays?.[0] || 'Dados inválidos.'
        };
    }

    try {
        const accountRef = adminDb.doc(`accounts/${accountId}`);
        await accountRef.update({
            backupPeriodicityDays: validatedFields.data.backupPeriodicityDays,
            backupRetentionDays: validatedFields.data.backupRetentionDays,
        });
        revalidatePath('/settings');
        return {
            message: 'success'
        };
    } catch (e) {
        return {
            message: 'error',
            error: handleFirebaseError(e)
        };
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
        return {
            message: 'error',
            error: 'Conta não identificada.'
        };
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

        await backupDocRef.update({
            status: 'completed'
        });

        const accountRef = db.doc(`accounts/${accountId}`);
        await accountRef.update({
            lastBackupDate: timestamp.toISOString()
        });

        if (typeof retentionDays === 'number' && retentionDays > 0) {
            await cleanupOldBackupsAction(accountId, retentionDays);
        }

        revalidatePath('/settings');
        return {
            message: 'success'
        };

    } catch (e) {
        await backupDocRef.update({
            status: 'failed',
            error: handleFirebaseError(e)
        });
        return {
            message: 'error',
            error: handleFirebaseError(e)
        };
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
        return {
            message: 'success',
            info: 'No old backups found.'
        };
    }

    const deletePromises: Promise < any > [] = [];
    snapshot.forEach(doc => {
        console.log(`Scheduling deletion for old backup: ${doc.id}`);
        deletePromises.push(deleteFirestoreBackupAction(accountId, doc.id));
    });

    try {
        await Promise.all(deletePromises);
        console.log(`Successfully deleted ${deletePromises.length} old backups.`);
        return {
            message: 'success',
            deletedCount: deletePromises.length
        };
    } catch (e) {
        return {
            message: 'error',
            error: handleFirebaseError(e)
        };
    }
}


export async function restoreFirestoreBackupAction(accountId: string, backupId: string) {
    if (!accountId || !backupId) {
        return {
            message: 'error',
            error: 'IDs de conta ou backup ausentes.'
        };
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
        return {
            message: 'success'
        };
    } catch (e) {
        console.error("Restore Error:", e);
        return {
            message: 'error',
            error: handleFirebaseError(e)
        };
    }
}

export async function deleteFirestoreBackupAction(accountId: string, backupId: string) {
    if (!accountId || !backupId) {
        return {
            message: 'error',
            error: 'IDs de conta ou backup ausentes.'
        };
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
        return {
            message: 'success'
        };
    } catch (e) {
        console.error("Delete Backup Error:", e);
        return {
            message: 'error',
            error: handleFirebaseError(e)
        };
    }
}

export async function deleteStorageFileAction(pathOrUrl: string) {
    try {
        let objectPath = pathOrUrl;

        // If it's a full URL, parse it to get the object path
        if (/^https?:\/\//.test(objectPath)) {
            const url = new URL(objectPath);
            // The path in Firebase Storage URLs is typically after "/o/" and before the "?alt=media" query parameter.
            const decodedPath = decodeURIComponent(url.pathname);
            const pathSegments = decodedPath.split('/o/');
            if (pathSegments.length > 1) {
                objectPath = pathSegments[1];
            } else {
                throw new Error("Could not determine object path from URL.");
            }
        }

        const bucket = getStorage(adminApp).bucket();
        await bucket.file(objectPath).delete({
            ignoreNotFound: true
        });
        return {
            message: 'success'
        };
    } catch (e: any) {
        console.error("Error deleting storage file:", e);
        if (e?.code === 404) {
            return {
                message: "error",
                error: "Arquivo não encontrado no bucket (404)."
            };
        }
        return {
            message: "error",
            error: `Falha ao excluir: ${e?.message ?? e}`
        };
    }
}


// #endregion

// #region Google Calendar Actions
export async function getGoogleAuthUrlAction(userId: string) {
    if (!userId) {
        return {
            error: 'Usuário não autenticado.'
        };
    }
    try {
        const oAuth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        const GMAIL_SCOPES = [
            'https://www.googleapis.com/auth/calendar.events'
        ];

        const url = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: GMAIL_SCOPES,
            state: userId, // Pass the user ID in the state parameter
        });

        return {
            url
        };
    } catch (error) {
        console.error("Error generating Google Auth URL:", error);
        return {
            error: 'Falha ao gerar URL de autenticação do Google.'
        };
    }
}

export async function disconnectGoogleCalendarAction(userId: string) {
    if (!userId) {
        return {
            message: 'error' as const, error: 'Usuário não identificado.'
        };
    }
    try {
        const userRef = adminDb.doc(`users/${userId}`);
        await userRef.update({
            googleCalendar: FieldValue.delete()
        });
        revalidatePath('/');
        return {
            message: 'success' as const
        };
    } catch (e) {
        return {
            message: 'error' as const, error: handleFirebaseError(e)
        };
    }
}

function toRfc3339(dateValue: any): string | undefined {
    if (!dateValue) return undefined;
    try {
        const d = new Date(dateValue);
        if (isNaN(d.getTime())) return undefined;
        return d.toISOString();
    } catch (e) {
        return undefined;
    }
}


async function syncCalendarEvent(
    calendar: any,
    calendarId: string,
    osRef: FirebaseFirestore.DocumentReference,
    eventIdField: 'googleCalendarEventId' | 'googleCalendarSwapEventId',
    eventResource: any
) {
    const osDoc = await osRef.get();
    const existingEventId = osDoc.data()?.[eventIdField];

    if (existingEventId) {
        try {
            await calendar.events.update({
                calendarId: calendarId,
                eventId: existingEventId,
                requestBody: eventResource,
            });
            console.log(`Evento ${existingEventId} (${eventIdField}) atualizado.`);
        } catch (updateError: any) {
            if (updateError.code === 404) {
                const newEvent = await calendar.events.insert({
                    calendarId: calendarId,
                    requestBody: eventResource,
                });
                if (newEvent.data.id) {
                    await osRef.update({
                        [eventIdField]: newEvent.data.id
                    });
                    console.log(`Novo evento ${newEvent.data.id} (${eventIdField}) criado.`);
                }
            } else {
                throw updateError;
            }
        }
    } else {
        const newEvent = await calendar.events.insert({
            calendarId: calendarId,
            requestBody: eventResource,
        });
        if (newEvent.data.id) {
            await osRef.update({
                [eventIdField]: newEvent.data.id
            });
            console.log(`Novo evento ${newEvent.data.id} (${eventIdField}) criado.`);
        }
    }
}


export async function syncOsToGoogleCalendarAction(userId: string, os: PopulatedRental | PopulatedOperation) {
    const userRef = adminDb.doc(`users/${userId}`);
    const userSnap = await userRef.get();
    if (!userSnap.exists) throw new Error("Usuário não encontrado");

    const userData = userSnap.data() as UserAccount;
    const googleCalendar = userData.googleCalendar;

    if (!googleCalendar || !googleCalendar.refreshToken || (googleCalendar as any).needsReauth) {
        console.log(`Google Calendar não configurado ou necessita reautenticação para o usuário ${userId}. Pulando sincronização.`);
        return;
    }

    const oAuth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );

    oAuth2Client.setCredentials({
        refresh_token: googleCalendar.refreshToken
    });

    try {
        const {
            credentials
        } = await oAuth2Client.refreshAccessToken();
        oAuth2Client.setCredentials(credentials);
        await userRef.update({
            'googleCalendar.accessToken': credentials.access_token,
            'googleCalendar.expiryDate': credentials.expiry_date,
            'googleCalendar.needsReauth': FieldValue.delete(),
        });
    } catch (error: any) {
        console.error(`Erro ao atualizar o token de acesso do Google para o usuário ${userId}:`, error.response?.data || error.message);
        await userRef.update({
            'googleCalendar.needsReauth': true
        });
        console.log(`Integração para o usuário ${userId} marcada para reautenticação.`);
        return;
    }

    const calendar = google.calendar({
        version: 'v3',
        auth: oAuth2Client
    });
    const calendarId = googleCalendar.calendarId || 'primary';

    if (os.itemType === 'rental') {
        const rental = os as PopulatedRental;
        const osRef = adminDb.doc(`accounts/${rental.accountId}/rentals/${rental.id}`);
        const dumpsterNames = (rental.dumpsters || []).map(d => d.name).join(', ');

        // --- Sync Main Rental Event ---
        const mainEventResource = {
            summary: `Aluguel: ${rental.client?.name} - Caçamba(s): ${dumpsterNames}`,
            description: `<b>OS:</b> #${rental.sequentialId}\n<b>Cliente:</b> ${rental.client?.name}\n<b>Caçambas:</b> ${dumpsterNames}\n<b>Local:</b> ${rental.deliveryAddress}\n<b>Observações:</b> ${rental.observations || ''}`,
            start: {
                dateTime: toRfc3339(rental.rentalDate),
                timeZone: 'America/Sao_Paulo'
            },
            end: {
                dateTime: toRfc3339(rental.returnDate),
                timeZone: 'America/Sao_Paulo'
            },
        };
        await syncCalendarEvent(calendar, calendarId, osRef, 'googleCalendarEventId', mainEventResource);

        // --- Sync Swap Event ---
        if (rental.swapDate) {
            const swapDateTime = parseISO(rental.swapDate);
            const swapEventResource = {
                summary: `Troca de Caçamba: ${rental.client?.name}`,
                description: `Troca agendada para a OS #${rental.sequentialId} no endereço ${rental.deliveryAddress}.`,
                start: {
                    dateTime: toRfc3339(swapDateTime),
                    timeZone: 'America/Sao_Paulo'
                },
                end: {
                    dateTime: toRfc3339(set(swapDateTime, {
                        minutes: swapDateTime.getMinutes() + 30
                    })),
                    timeZone: 'America/Sao_Paulo'
                }, // Assuming 30 min duration
            };
            await syncCalendarEvent(calendar, calendarId, osRef, 'googleCalendarSwapEventId', swapEventResource);
        }

    } else { // 'operation'
        const operation = os as PopulatedOperation;
        const osRef = adminDb.doc(`accounts/${operation.accountId}/operations/${operation.id}`);
        const opTypes = operation.operationTypes.map(t => t.name).join(', ');

        const eventResource = {
            summary: `${opTypes} - ${operation.client?.name}`,
            description: `<b>OS:</b> #${operation.sequentialId}\n<b>Cliente:</b> ${operation.client?.name}\n<b>Destino:</b> ${operation.destinationAddress}\n<b>Observações:</b> ${operation.observations || ''}`,
            start: {
                dateTime: toRfc3339(operation.startDate),
                timeZone: 'America/Sao_Paulo'
            },
            end: {
                dateTime: toRfc3339(operation.endDate),
                timeZone: 'America/Sao_Paulo'
            },
        };
        await syncCalendarEvent(calendar, calendarId, osRef, 'googleCalendarEventId', eventResource);
    }
}


export async function syncAllOsToGoogleCalendarAction(userId: string) {
    const userRef = adminDb.doc(`users/${userId}`);
    const userSnap = await userRef.get();
    if (!userSnap.exists) throw new Error("Usuário não encontrado.");

    const userData = userSnap.data() as UserAccount;
    if (!userData.googleCalendar || !userData.accountId) {
        console.log("Integração com o Google Agenda ou accountId não configurados para este usuário.");
        return {
            message: 'error',
            error: 'Integração com Google Agenda não configurada.'
        };
    }

    const rentals = await getPopulatedRentalsForServer(userData.accountId);
    const operations = await getPopulatedOperationsForServer(userData.accountId);

    const syncPromises = [
        ...rentals.map(os => syncOsToGoogleCalendarAction(userId, os)),
        ...operations.map(os => syncOsToGoogleCalendarAction(userId, os)),
    ];

    try {
        await Promise.all(syncPromises);
        return {
            message: 'success'
        };
    } catch (e) {
        console.error("Error during batch sync:", e);
        return {
            message: 'error',
            error: 'Falha ao sincronizar todos os eventos.'
        };
    }
}

// #endregion

// #region Notification Actions
export async function uploadNotificationImageAction(accountId: string, image: UploadedImage) {
    if (!accountId || !image) {
        return {
            message: 'error' as const, error: 'Dados insuficientes para o upload.'
        };
    }

    const validatedImage = UploadedImageSchema.safeParse(image);
    if (!validatedImage.success) {
        return {
            message: 'error' as const, error: 'Objeto de imagem inválido.'
        };
    }

    try {
        await adminDb.doc(`accounts/${accountId}`).update({
            notificationImages: FieldValue.arrayUnion(validatedImage.data)
        });

        revalidatePath('/notifications-studio');

        return {
            message: 'success' as const, newImage: validatedImage.data
        };

    } catch (e) {
        console.error("Upload server action error:", e);
        return {
            message: 'error' as const, error: handleFirebaseError(e)
        };
    }
}

export async function deleteNotificationImageAction(accountId: string, imagePath: string) {
    if (!accountId || !imagePath) {
        return {
            message: 'error' as const, error: 'Informações incompletas.'
        };
    }

    try {
        const accountRef = adminDb.doc(`accounts/${accountId}`);
        const accountSnap = await accountRef.get();
        if (accountSnap.exists) {
            const currentImages: UploadedImage[] = accountSnap.data()?.notificationImages || [];
            const updatedImages = currentImages.filter(img => img.path !== imagePath);
            await accountRef.update({
                notificationImages: updatedImages
            });
        }

        revalidatePath('/notifications-studio');
        return {
            message: 'success' as const
        };
    } catch (e) {
        console.error('Error deleting notification image reference from DB:', e);
        return {
            message: 'error' as const, error: handleFirebaseError(e)
        };
    }
}


export async function updateNotificationImagesAction(accountId: string, images: UploadedImage[]) {
    if (!accountId) {
        return {
            message: 'error',
            error: 'Conta não identificada.'
        };
    }
    const validatedImages = z.array(UploadedImageSchema).safeParse(images);
    if (!validatedImages.success) {
        return {
            message: 'error',
            error: 'Dados de imagem inválidos.'
        };
    }
    try {
        const accountRef = adminDb.doc(`accounts/${accountId}`);
        await accountRef.update({
            notificationImages: validatedImages.data
        });
        revalidatePath('/notifications-studio');
        return {
            message: 'success'
        };
    } catch (e) {
        return {
            message: 'error',
            error: handleFirebaseError(e)
        };
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
        const rental = {
            id: doc.id,
            ...doc.data()
        } as Rental;
        const returnDate = parseISO(rental.returnDate);

        if (isToday(addDays(returnDate, -1)) && !rental.notificationsSent?.due) {
            await sendNotification({
                userId: rental.assignedTo,
                title: 'Lembrete de Retirada',
                body: `A OS para ${rental.deliveryAddress} vence amanhã.`,
            });
            batch.update(doc.ref, {
                'notificationsSent.due': true
            });
            notificationsSentCount++;
        }

        if (isAfter(today, returnDate) && !rental.notificationsSent?.late) {
            await sendNotification({
                userId: rental.assignedTo,
                title: 'OS Atrasada!',
                body: `A OS para ${rental.deliveryAddress} está atrasada.`,
            });
            batch.update(doc.ref, {
                'notificationsSent.late': true
            });
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
        return {
            message: 'error',
            error: firstError || 'Dados do formulário inválidos.'
        };
    }

    const {
        title,
        message,
        targetType,
        targetIds,
        imageUrl,
        linkUrl,
        senderAccountId
    } = parsed.data;

    try {
        let recipientIds: string[] = [];

        switch (targetType) {
            case 'all-company':
                const usersSnap = await adminDb.collection('users').get();
                recipientIds = usersSnap.docs.map(d => d.id);
                break;
            case 'my-team':
                {
                    const accountSnap = await adminDb.doc(`accounts/${senderAccountId}`).get();
                    recipientIds = accountSnap.data()?.members || [];
                    break;
                }
            case 'specific-members':
                {
                    recipientIds = targetIds ? targetIds.split(',') : [];
                    break;
                }
            case 'specific-clients':
                {
                    if (!targetIds) break;
                    const accountIds = targetIds.split(',');
                    const accountPromises = accountIds.map(id => adminDb.doc(`accounts/${id}`).get());
                    const accountSnaps = await Promise.all(accountPromises);
                    recipientIds = accountSnaps.flatMap(snap => snap.data()?.members || []);
                    break;
                }
            case 'specific-users':
                {
                    if (!targetIds) break;
                    recipientIds = targetIds.split(',');
                    break;
                }
        }

        if (recipientIds.length === 0) {
            return {
                message: 'error',
                error: 'Nenhum destinatário encontrado para a seleção.'
            };
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

        return {
            message: 'success'
        };
    } catch (e) {
        return {
            message: 'error',
            error: handleFirebaseError(e)
        };
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
    if (!invokerId) return {
        message: 'Apenas Super Admins podem criar outros Super Admins.'
    };

    const invokerUser = await adminAuth.getUser(invokerId);
    if (invokerUser.customClaims?.role !== 'superadmin') {
        return {
            message: 'Apenas Super Admins podem criar outros Super Admins.'
        };
    }

    const validatedFields = SuperAdminCreationSchema.safeParse(Object.fromEntries(formData.entries()));

    if (!validatedFields.success) {
        return {
            message: 'Dados do formulário inválidos.'
        };
    }

    const {
        name,
        email,
        password
    } = validatedFields.data;

    try {
        const {
            accountId,
            userId
        } = await ensureUserDocument({
            name,
            email,
            password
        }, null, 'superadmin');

        revalidatePath('/admin/superadmins');
        return {
            message: 'success',
            newUser: {
                name,
                email,
                password
            }
        };

    } catch (e) {
        return {
            message: handleFirebaseError(e)
        };
    }
}

export async function deleteSuperAdminAction(userId: string) {
    try {
        await adminAuth.deleteUser(userId);
        await adminDb.doc(`users/${userId}`).delete();
        revalidatePath('/admin/superadmins');
        return {
            message: 'success'
        };
    } catch (e) {
        return {
            message: 'error',
            error: handleFirebaseError(e)
        };
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
                    await adminAuth.updateUser(memberId, {
                        disabled
                    });
                    const memberRef = adminDb.doc(`users/${memberId}`);
                    batch.update(memberRef, {
                        status: newStatus
                    });
                }
                await batch.commit();
            }
        } else {
            await adminAuth.updateUser(userId, {
                disabled
            });
            await userRef.update({
                status: newStatus
            });
        }

        revalidatePath('/admin/clients');
        return {
            message: 'success'
        };
    } catch (e) {
        return {
            message: 'error',
            error: handleFirebaseError(e)
        };
    }
}

export async function deleteClientAccountAction(accountId: string, ownerId: string) {
    if (!accountId || !ownerId) {
        return {
            message: 'error',
            error: 'ID da conta ou do proprietário ausente.'
        };
    }

    try {
        const db = adminDb;
        const accountRef = db.doc(`accounts/${accountId}`);
        const accountSnap = await accountRef.get();
        if (!accountSnap.exists) {
            return {
                message: 'success',
                info: 'Account already deleted.'
            };
        }

        const memberIds: string[] = accountSnap.data()?.members || [];

        const collectionsToDelete = ['clients', 'dumpsters', 'rentals', 'completed_rentals', 'trucks', 'operations', 'completed_operations'];
        let allAttachmentPaths: string[] = [];

        for (const collection of collectionsToDelete) {
            const paths = await deleteCollectionByPath(db, `accounts/${accountId}/${collection}`, 50);
            allAttachmentPaths = allAttachmentPaths.concat(paths);
        }

        for (const path of allAttachmentPaths) {
            await deleteStorageFileAction(path);
        }

        const batch = db.batch();
        memberIds.forEach(userId => {
            const userRef = db.doc(`users/${userId}`);
            batch.delete(userRef);
        });
        batch.delete(accountRef);
        await batch.commit();

        const authDeletePromises = memberIds.map(userId => adminAuth.deleteUser(userId).catch(e => console.warn(`Could not delete auth user ${userId}`, e)));
        await Promise.all(authDeletePromises);

        revalidatePath('/admin/clients');
        return {
            message: 'success'
        };

    } catch (e) {
        return {
            message: 'error',
            error: handleFirebaseError(e)
        };
    }
}




// #endregion























































export async function cancelRecurrenceAction(accountId: string, recurrenceProfileId: string) {
    if (!accountId || !recurrenceProfileId) {
        return {
            message: 'error',
            error: 'IDs ausentes.'
        };
    }

    try {
        const recurrenceRef = adminDb.doc(`accounts/${accountId}/recurrence_profiles/${recurrenceProfileId}`);
        await recurrenceRef.update({
            status: 'cancelled',
            updatedAt: FieldValue.serverTimestamp()
        });

        revalidatePath('/os');
        return {
            message: 'success'
        };
    } catch (e) {
        return {
            message: 'error',
            error: handleFirebaseError(e)
        };
    }
}
    
    

    