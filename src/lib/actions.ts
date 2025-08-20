
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { addClient, addDumpster, updateClient as updateClientData, updateDumpster as updateDumpsterData, deleteClient as deleteClientData, deleteDumpster as deleteDumpsterData, addRental, updateDumpsterStatus, completeRental, getRentalById, deleteAllCompletedRentals, updateRental as updateRentalData } from './data-server';
import type { DumpsterStatus, Rental } from './types';
import { differenceInCalendarDays } from 'date-fns';


const dumpsterSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres.'),
  status: z.enum(['Disponível', 'Alugada', 'Em Manutenção']),
  color: z.string().min(3, 'A cor deve ter pelo menos 3 caracteres.'),
  size: z.coerce.number().min(1, 'O tamanho deve ser maior que 0.'),
});

export async function createDumpster(userId: string, prevState: any, formData: FormData) {
  if (!userId) return { message: 'error', error: 'Usuário não autenticado.' };

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
    await addDumpster(userId, validatedFields.data);
  } catch (e) {
    console.error(e);
    return { ...prevState, message: 'error', error: 'Falha ao criar caçamba.' };
  }
  
  revalidatePath('/dumpsters');
  revalidatePath('/rentals/new');
  return { ...prevState, message: "success" };
}

export async function updateDumpster(userId: string, state:any, formData: FormData) {
  if (!userId) return { message: 'error', error: 'Usuário não autenticado.' };
  
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
    await updateDumpsterData(userId, validatedFields.data as any);
  } catch (e) {
    return { error: 'Falha ao atualizar caçamba.', message: 'error' };
  }
  
  revalidatePath('/dumpsters');
  revalidatePath('/');
  return { message: "success" };
}

export async function deleteDumpsterAction(userId: string, id: string) {
    if (!userId) return { message: 'error', error: 'Usuário não autenticado.' };
    try {
        await deleteDumpsterData(userId, id);
        revalidatePath('/dumpsters');
        return { message: 'success', title: 'Sucesso!', description: 'Caçamba excluída.' };
    } catch (e: any) {
        return { message: 'error', error: e.message };
    }
}

export async function updateDumpsterStatusAction(userId: string, id: string, status: DumpsterStatus) {
    if (!userId) return { message: 'error', error: 'Usuário não autenticado.' };
    try {
        await updateDumpsterStatus(userId, id, status);
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

export async function createClient(userId: string, prevState: any, formData: FormData) {
  if (!userId) return { message: 'error', error: 'Usuário não autenticado.' };

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
    await addClient(userId, validatedFields.data);
  } catch (e) {
    console.error(e);
    return { ...prevState, message: 'error', error: 'Falha ao criar cliente.' };
  }

  revalidatePath('/clients');
  revalidatePath('/rentals/new');
  return { ...prevState, message: "success" };
}

export async function updateClient(userId: string, prevState: any, formData: FormData) {
  if (!userId) return { message: 'error', error: 'Usuário não autenticado.' };

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
    await updateClientData(userId, validatedFields.data as any);
  } catch (e) {
    return { error: 'Falha ao atualizar cliente.', message: 'error' };
  }
  
  revalidatePath('/clients');
  revalidatePath('/');
  return { message: "success" };
}

export async function deleteClientAction(userId: string, id: string) {
    if (!userId) return { message: 'error', error: 'Usuário não autenticado.' };
    try {
        await deleteClientData(userId, id);
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
}).refine(data => data.returnDate > data.rentalDate, {
  message: "A data de retirada deve ser após a data de entrega.",
  path: ["returnDate"],
});


export async function createRental(userId: string, prevState: any, formData: FormData) {
    if (!userId) return { message: 'error', error: 'Usuário não autenticado.' };
    
    const data = {
        dumpsterId: formData.get('dumpsterId'),
        clientId: formData.get('clientId'),
        deliveryAddress: formData.get('deliveryAddress'),
        latitude: formData.get('latitude'),
        longitude: formData.get('longitude'),
        rentalDate: formData.get('rentalDate'),
        returnDate: formData.get('returnDate'),
        value: formData.get('value'),
    }

    const validatedFields = rentalSchema.safeParse(data);

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
        };
    }

    try {
        await addRental(userId, {
            ...validatedFields.data,
            status: 'Ativo',
        });
        await updateDumpsterStatus(userId, validatedFields.data.dumpsterId, 'Alugada');
    } catch (e) {
        console.error(e);
        return { errors: {}, message: 'Falha ao criar aluguel.' };
    }
    
    revalidatePath('/');
    revalidatePath('/rentals/new');
    revalidatePath('/dumpsters');
    redirect('/');
}

export async function finishRentalAction(userId: string, formData: FormData) {
    if (!userId) {
        throw new Error("Usuário não autenticado.");
    }
    const rentalId = formData.get('rentalId') as string;
    
    if (!rentalId) {
      throw new Error("ID do aluguel ausente.");
    }

    try {
        // First, get the rental data to calculate total value
        const rental = await getRentalById(userId, rentalId);
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
        };

        await completeRental(userId, rentalId, rental.dumpsterId, completedRentalData);
    } catch (e) {
        console.error(e);
        throw new Error("Falha ao finalizar o aluguel.");
    }

    revalidatePath('/');
    revalidatePath('/stats');
    redirect('/');
}

const updateRentalSchema = z.object({
  id: z.string(),
  returnDate: z.coerce.date(),
});


export async function updateRentalAction(userId: string, prevState: any, formData: FormData) {
  if (!userId) return { message: 'error', error: 'Usuário não autenticado.' };
  
  const validatedFields = updateRentalSchema.safeParse({
    id: formData.get('id'),
    returnDate: formData.get('returnDate'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'validation_error',
    };
  }

  try {
    const rental = await getRentalById(userId, validatedFields.data.id);
    if (!rental) {
        return { message: 'error', error: 'Aluguel não encontrado.' };
    }
    // Firestore Admin SDK returns Timestamps, need to convert to Dates for comparison
    const rentalDate = (rental.rentalDate as any).toDate ? (rental.rentalDate as any).toDate() : rental.rentalDate;
    if (new Date(validatedFields.data.returnDate) < rentalDate) {
        throw new Error('A data de devolução não pode ser anterior à data de aluguel.');
    }
    await updateRentalData(userId, validatedFields.data.id, { returnDate: validatedFields.data.returnDate });
    revalidatePath('/');
    return { message: 'success' };
  } catch (e: any) {
    return { error: e.message, message: 'error' };
  }
}

export async function resetBillingDataAction(userId: string) {
    if (!userId) {
        return { message: 'error', error: 'Usuário não autenticado.' };
    }

    try {
        await deleteAllCompletedRentals(userId);
        revalidatePath('/stats');
        return { message: 'success' };
    } catch (e) {
        console.error("Falha ao zerar dados de faturamento:", e);
        return { message: 'error', error: 'Ocorreu um erro ao tentar zerar os dados de faturamento.' };
    }
}
