'use server';

import { z } from 'zod';
import { addClient, addDumpster, addRental, completeRental, updateClient as updateClientData, updateDumpster as updateDumpsterData } from './data';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const dumpsterSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres.'),
  status: z.enum(['Disponível', 'Alugada', 'Em Manutenção']),
});

export async function createDumpster(prevState: any, formData: FormData) {
  const validatedFields = dumpsterSchema.safeParse({
    name: formData.get('name'),
    status: formData.get('status'),
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
  } catch (e) {
    return { error: 'Falha ao atualizar caçamba.', message: 'error' };
  }
  
  return { message: "success" };
}

const clientSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres.'),
  phone: z.string().min(10, 'O telefone deve ser válido.'),
  address: z.string().min(5, 'O endereço deve ter pelo menos 5 caracteres.'),
});

export async function createClient(prevState: any, formData: FormData) {
  const validatedFields = clientSchema.safeParse({
    name: formData.get('name'),
    phone: formData.get('phone'),
    address: formData.get('address'),
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
  } catch (e) {
    return { error: 'Falha ao atualizar cliente.', message: 'error' };
  }

  return { message: "success" };
}


const rentalSchema = z.object({
  dumpsterId: z.string().min(1, 'Selecione uma caçamba.'),
  clientId: z.string().min(1, 'Selecione um cliente.'),
  deliveryAddress: z.string().min(5, 'O endereço de entrega é obrigatório.'),
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