'use server';

import { z } from 'zod';
import { addClient, addDumpster, addRental, completeRental } from './data';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const dumpsterSchema = z.object({
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
    };
  }

  try {
    await addDumpster(validatedFields.data);
    revalidatePath('/dumpsters');
    revalidatePath('/rentals/new');
    return { success: true, message: "Caçamba criada com sucesso." };
  } catch (e) {
    return { error: 'Falha ao criar caçamba.' };
  }
}

const clientSchema = z.object({
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
    };
  }
  
  try {
    await addClient(validatedFields.data);
    revalidatePath('/clients');
    revalidatePath('/rentals/new');
    return { success: true, message: "Cliente criado com sucesso." };
  } catch (e) {
    return { error: 'Falha ao criar cliente.' };
  }
}

const rentalSchema = z.object({
  dumpsterId: z.string().min(1, 'Selecione uma caçamba.'),
  clientId: z.string().min(1, 'Selecione um cliente.'),
  deliveryAddress: z.string().min(5, 'O endereço de entrega é obrigatório.'),
  rentalDate: z.coerce.date(),
  returnDate: z.coerce.date().min(new Date(), { message: "Data de retorno deve ser no futuro." }),
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
    } catch (e) {
        return { error: 'Falha ao criar aluguel.' };
    }
    
    redirect('/');
}

export async function finishRental(formData: FormData) {
    const rentalId = formData.get('rentalId') as string;
    const dumpsterId = formData.get('dumpsterId') as string;
    if (!rentalId) {
        return { error: 'ID do aluguel não encontrado.' };
    }
    if (!dumpsterId) {
        return { error: 'ID da caçamba não encontrado.' };
    }
    try {
        await completeRental(rentalId, dumpsterId);
        revalidatePath('/');
        revalidatePath('/dumpsters');
    } catch (e) {
        console.error(e);
        // In a real app, you'd handle this error more gracefully
        return { error: 'Falha ao finalizar aluguel.' };
    }
}
