'use server';

import { z } from 'zod';
import { addClient, addDumpster, addRental, completeRental, deleteClient as deleteClientData, deleteDumpster as deleteDumpsterData, updateClient as updateClientData, updateDumpster as updateDumpsterData, updateRental as updateRentalData } from './data';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { DumpsterStatus, Rental } from './types';

const dumpsterSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres.'),
  status: z.enum(['Disponível', 'Alugada', 'Em Manutenção']),
  color: z.string().min(3, 'A cor deve ter pelo menos 3 caracteres.'),
  size: z.coerce.number().min(1, 'O tamanho deve ser maior que 0.'),
});

export async function createDumpster(prevState: any, formData: FormData) {
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
    await addDumpster(validatedFields.data);
    revalidatePath('/dumpsters');
    revalidatePath('/rentals/new');
  } catch (e) {
    return { error: 'Falha ao criar caçamba.', message: 'error' };
  }
  
  return { message: "success" };
}

export async function updateDumpster(prevState: any, formData: FormData) {
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
    await updateDumpsterData(validatedFields.data as any);
    revalidatePath('/dumpsters');
    revalidatePath('/');
  } catch (e) {
    return { error: 'Falha ao atualizar caçamba.', message: 'error' };
  }
  
  return { message: "success" };
}

export async function deleteDumpster(id: string) {
    try {
        await deleteDumpsterData(id);
        revalidatePath('/dumpsters');
        return { message: 'success', title: 'Sucesso!', description: 'Caçamba excluída.' };
    } catch (e: any) {
        return { message: 'error', error: e.message };
    }
}

export async function updateDumpsterStatus(id: string, status: DumpsterStatus) {
    try {
        await updateDumpsterData({ id, status } as any);
        revalidatePath('/dumpsters');
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

export async function createClient(prevState: any, formData: FormData) {
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
    await addClient(validatedFields.data);
    revalidatePath('/clients');
    revalidatePath('/rentals/new');
  } catch (e) {
    return { error: 'Falha ao criar cliente.', message: 'error' };
  }

  return { message: "success" };
}

export async function updateClient(prevState: any, formData: FormData) {
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
    await updateClientData(validatedFields.data as any);
    revalidatePath('/clients');
    revalidatePath('/');
  } catch (e) {
    return { error: 'Falha ao atualizar cliente.', message: 'error' };
  }

  return { message: "success" };
}

export async function deleteClient(id: string) {
    try {
        await deleteClientData(id);
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
}).refine(data => data.returnDate > data.rentalDate, {
  message: "A data de retirada deve ser após a data de entrega.",
  path: ["returnDate"],
});


export async function createRental(prevState: any, formData: FormData) {
    const data = {
        dumpsterId: formData.get('dumpsterId'),
        clientId: formData.get('clientId'),
        deliveryAddress: formData.get('deliveryAddress'),
        latitude: formData.get('latitude'),
        longitude: formData.get('longitude'),
        rentalDate: formData.get('rentalDate'),
        returnDate: formData.get('returnDate'),
    }

    const validatedFields = rentalSchema.safeParse(data);

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
        };
    }

    try {
        await addRental({
            ...validatedFields.data,
            status: 'Ativo',
        });
        revalidatePath('/');
        revalidatePath('/dumpsters');
        revalidatePath('/rentals/new');
    } catch (e) {
        return { error: 'Falha ao criar aluguel.' };
    }
    
    redirect('/');
}

export async function finishRental(formData: FormData) {
    const rentalId = formData.get('rentalId') as string;
    const dumpsterId = formData.get('dumpsterId') as string;
    
    if (!rentalId || !dumpsterId) {
      console.error("IDs de aluguel ou caçamba ausentes.");
      return;
    }

    try {
        await completeRental(rentalId, dumpsterId);
        revalidatePath('/');
        revalidatePath('/dumpsters');
    } catch (e) {
        console.error(e);
    }

    redirect('/');
}

const updateRentalSchema = z.object({
  id: z.string(),
  returnDate: z.coerce.date(),
});


export async function updateRental(prevState: any, formData: FormData) {
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
    await updateRentalData(validatedFields.data as Rental);
    revalidatePath('/');
    return { message: 'success' };
  } catch (e: any) {
    return { error: e.message, message: 'error' };
  }
}
