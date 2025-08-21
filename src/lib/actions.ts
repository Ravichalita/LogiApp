
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { addClient, addDumpster, updateClient as updateClientData, updateDumpster as updateDumpsterData, deleteClient as deleteClientData, deleteDumpster as deleteDumpsterData, addRental, completeRental, getRentalById, deleteAllCompletedRentals, updateRental as updateRentalData, cancelRental } from './data';
import type { Dumpster, DumpsterStatus, Rental } from './types';
import { differenceInCalendarDays } from 'date-fns';
import * as admin from 'firebase-admin';

// Helper function to initialize admin and create user/account docs
async function createAccountForNewUserWithAdmin(userId: string, email: string) {
    // Initialize Firebase Admin SDK if not already initialized
    if (!admin.apps.length) {
       // Providing the projectId is crucial for the Admin SDK to know which project to connect to.
      admin.initializeApp({
        projectId: "caambacontrol3"
      });
    }
    const adminDb = admin.firestore();

    try {
        const batch = adminDb.batch();

        const accountRef = adminDb.collection('accounts').doc();
        batch.set(accountRef, {
            ownerId: userId,
            name: `${email}'s Account`,
            createdAt: new Date(),
        });

        const userRef = adminDb.collection('users').doc(userId);
        batch.set(userRef, {
            email: email,
            accountId: accountRef.id,
            role: 'admin',
        });

        await batch.commit();

    } catch(error) {
        console.error("Error creating account and user document with Admin SDK:", error);
        throw new Error("Falha ao salvar informações do usuário no banco de dados.");
    }
}


const createUserAccountSchema = z.object({
  userId: z.string().min(1, 'User ID is required.'),
  email: z.string().email('Invalid email format.'),
});

export async function createUserAccountAction(data: z.infer<typeof createUserAccountSchema>) {
  const validatedFields = createUserAccountSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      message: 'error',
      error: 'Dados de usuário inválidos.',
    };
  }

  try {
    await createAccountForNewUserWithAdmin(validatedFields.data.userId, validatedFields.data.email);
    return { message: 'success' };
  } catch (e: any) {
    console.error("Error in createUserAccountAction:", e);
    return { message: 'error', error: e.message || 'Falha ao criar a conta no Firestore.' };
  }
}


const dumpsterSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres.'),
  status: z.enum(['Disponível', 'Em Manutenção']),
  color: z.string().min(3, 'A cor deve ter pelo menos 3 caracteres.'),
  size: z.coerce.number().min(1, 'O tamanho deve ser maior que 0.'),
});

export async function createDumpster(accountId: string, prevState: any, formData: FormData) {
  if (!accountId) return { message: 'error', error: 'Conta não identificada.' };

  const validatedFields = dumpsterSchema.safeParse({
    name: formData.get('name'),
    status: formData.get('status'),
    color: formData.get('color'),
    size: formData.get('size'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'validation_error',
    };
  }

  try {
    await addDumpster(accountId, validatedFields.data);
  } catch (e) {
    console.error(e);
    return { ...prevState, message: 'error', error: 'Falha ao criar caçamba.' };
  }
  
  revalidatePath('/dumpsters');
  revalidatePath('/rentals/new');
  return { ...prevState, message: "success" };
}

export async function updateDumpster(accountId: string, state:any, formData: FormData) {
  if (!accountId) return { message: 'error', error: 'Conta não identificada.' };
  
  const validatedFields = dumpsterSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    status: formData.get('status'),
    color: formData.get('color'),
    size: formData.get('size'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'validation_error',
    };
  }

  try {
    await updateDumpsterData(accountId, validatedFields.data as any);
  } catch (e) {
    return { error: 'Falha ao atualizar caçamba.', message: 'error' };
  }
  
  revalidatePath('/dumpsters');
  revalidatePath('/');
  return { message: "success" };
}

export async function deleteDumpsterAction(accountId: string, id: string) {
    if (!accountId) return { message: 'error', error: 'Conta não identificada.' };
    try {
        await deleteDumpsterData(accountId, id);
        revalidatePath('/dumpsters');
        return { message: 'success', title: 'Sucesso!', description: 'Caçamba excluída.' };
    } catch (e: any) {
        return { message: 'error', error: e.message };
    }
}

export async function updateDumpsterStatusAction(accountId: string, id: string, status: DumpsterStatus) {
    if (!accountId) return { message: 'error', error: 'Conta não identificada.' };
    try {
        await updateDumpsterData(accountId, { id, status } as Dumpster);
        revalidatePath('/dumpsters');
        revalidatePath('/rentals/new');
        revalidatePath('/');
        return { message: 'success' };
    } catch (e) {
        return { message: 'error', error: 'Falha ao atualizar status da caçamba.' };
    }
}


const clientSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres.'),
  phone: z.string().min(10, 'O telefone deve ser válido.'),
  address: z.string().min(5, 'O endereço deve ter pelo menos 5 caracteres.'),
  email: z.string().email('O e-mail deve ser válido.').optional().or(z.literal('')),
  observations: z.string().optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
});

export async function createClient(accountId: string, prevState: any, formData: FormData) {
  if (!accountId) return { message: 'error', error: 'Conta não identificada.' };

  const validatedFields = clientSchema.safeParse({
    name: formData.get('name'),
    phone: formData.get('phone'),
    address: formData.get('address'),
    email: formData.get('email'),
    observations: formData.get('observations'),
    latitude: formData.get('latitude'),
    longitude: formData.get('longitude'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'validation_error',
    };
  }
  
  try {
    await addClient(accountId, validatedFields.data);
  } catch (e) {
    console.error(e);
    return { ...prevState, message: 'error', error: 'Falha ao criar cliente.' };
  }

  revalidatePath('/clients');
  revalidatePath('/rentals/new');
  return { ...prevState, message: "success" };
}

export async function updateClient(accountId: string, prevState: any, formData: FormData) {
  if (!accountId) return { message: 'error', error: 'Conta não identificada.' };

  const validatedFields = clientSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    phone: formData.get('phone'),
    address: formData.get('address'),
    email: formData.get('email'),
    observations: formData.get('observations'),
    latitude: formData.get('latitude'),
    longitude: formData.get('longitude'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'validation_error',
    };
  }

  try {
    await updateClientData(accountId, validatedFields.data as any);
  } catch (e) {
    return { error: 'Falha ao atualizar cliente.', message: 'error' };
  }
  
  revalidatePath('/clients');
  revalidatePath('/');
  return { message: "success" };
}

export async function deleteClientAction(accountId: string, id: string) {
    if (!accountId) return { message: 'error', error: 'Conta não identificada.' };
    try {
        await deleteClientData(accountId, id);
        revalidatePath('/clients');
        return { message: 'success' };
    } catch (e: any) {
        return { message: 'error', error: e.message };
    }
}


const rentalSchema = z.object({
  dumpsterId: z.string().min(1, 'Selecione uma caçamba.'),
  clientId: z.string().min(1, 'Selecione um cliente.'),
  deliveryAddress: z.string().min(5, 'O endereço de entrega é obrigatório.'),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  rentalDate: z.coerce.date(),
  returnDate: z.coerce.date(),
  value: z.string().transform(val => Number(val.replace('R$', '').replace(/\./g, '').replace(',', '.').trim())).pipe(z.number().positive('O valor deve ser maior que zero.')),
  assignedTo: z.string().optional(),
}).refine(data => data.returnDate > data.rentalDate, {
  message: "A data de retirada deve ser após a data de entrega.",
  path: ["returnDate"],
});


export async function createRental(accountId: string, userId: string, prevState: any, formData: FormData) {
    if (!accountId) return { message: 'error', error: 'Conta não identificada.' };
    
    const data = {
        dumpsterId: formData.get('dumpsterId'),
        clientId: formData.get('clientId'),
        deliveryAddress: formData.get('deliveryAddress'),
        latitude: formData.get('latitude'),
        longitude: formData.get('longitude'),
        rentalDate: formData.get('rentalDate'),
        returnDate: formData.get('returnDate'),
        value: formData.get('value'),
        assignedTo: userId, // Automatically assign to the user creating it
    }

    const validatedFields = rentalSchema.safeParse(data);

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
        };
    }

    try {
        await addRental(accountId, {
            ...validatedFields.data,
            status: 'Ativo',
        });
    } catch (e) {
        console.error(e);
        return { errors: {}, message: 'Falha ao criar aluguel.' };
    }
    
    revalidatePath('/');
    revalidatePath('/rentals/new');
    revalidatePath('/dumpsters');
    redirect('/');
}

export async function finishRentalAction(accountId: string, formData: FormData) {
    if (!accountId) {
        throw new Error("Conta não identificada.");
    }
    const rentalId = formData.get('rentalId') as string;
    
    if (!rentalId) {
      throw new Error("ID do aluguel ausente.");
    }

    try {
        const rental = await getRentalById(accountId, rentalId);
        if (!rental) {
            throw new Error("Aluguel não encontrado.");
        }

        const rentalDays = differenceInCalendarDays(rental.returnDate, rental.rentalDate) || 1;
        const totalValue = rental.value * rentalDays;

        const completedRentalData = {
            dumpsterId: rental.dumpsterId,
            clientId: rental.clientId,
            rentalDate: rental.rentalDate,
            returnDate: rental.returnDate,
            completedDate: new Date(),
            totalValue,
            rentalDays,
            assignedTo: rental.assignedTo,
        };

        await completeRental(accountId, rentalId, completedRentalData);

    } catch (e) {
        console.error(e);
        throw new Error("Falha ao finalizar o aluguel.");
    }

    revalidatePath('/');
    revalidatePath('/stats');
    revalidatePath('/dumpsters');
    redirect('/');
}

export async function cancelRentalAction(accountId: string, rentalId: string) {
    if (!accountId) {
        return { message: 'error', error: 'Conta não identificada.' };
    }
    if (!rentalId) {
        return { message: 'error', error: 'Informações do aluguel ausentes.' };
    }

    try {
        await cancelRental(accountId, rentalId);
    } catch (e: any) {
        console.error("Error canceling rental:", e);
        return { message: 'error', error: 'Falha ao cancelar o aluguel.' };
    }

    revalidatePath('/');
    revalidatePath('/dumpsters');
    return { message: 'success' };
}


const updateRentalSchema = z.object({
  id: z.string(),
  rentalDate: z.coerce.date(),
  returnDate: z.coerce.date(),
}).refine(data => data.returnDate > data.rentalDate, {
    message: "A data de retirada deve ser após a data de entrega.",
    path: ["returnDate"],
});


export async function updateRentalAction(accountId: string, prevState: any, formData: FormData) {
  if (!accountId) return { message: 'error', error: 'Conta não identificada.' };
  
  const data = {
    id: formData.get('id'),
    rentalDate: formData.get('rentalDate'),
    returnDate: formData.get('returnDate'),
  };
  
  const validatedFields = updateRentalSchema.safeParse(data);

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'validation_error',
    };
  }

  try {
    await updateRentalData(accountId, validatedFields.data.id, { 
        returnDate: validatedFields.data.returnDate,
        rentalDate: validatedFields.data.rentalDate,
    });
    revalidatePath('/');
  } catch (e: any) {
    return { error: e.message, message: 'error' };
  }
  revalidatePath('/dumpsters');
  return { message: 'success' };
}

export async function resetBillingDataAction(accountId: string) {
    if (!accountId) {
        return { message: 'error', error: 'Conta não identificada.' };
    }

    try {
        await deleteAllCompletedRentals(accountId);
        revalidatePath('/stats');
        return { message: 'success' };
    } catch (e) {
        console.error("Falha ao zerar dados de faturamento:", e);
        return { message: 'error', error: 'Ocorreu um erro ao tentar zerar os dados de faturamento.' };
    }
}

    