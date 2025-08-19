'use server';
import type { Dumpster, Client, Rental, DumpsterStatus } from './types';
import { db } from './db';

// --- Data Retrieval Functions ---

export const getDumpsters = async (): Promise<Dumpster[]> => {
  return await db.read('dumpsters');
};

export const getClients = async (): Promise<Client[]> => {
  return await db.read('clients');
};

export const getRentals = async (): Promise<Rental[]> => {
  const rentalsData = await db.read<any[]>('rentals');
  // Dates are stored as ISO strings in JSON, so we need to convert them back to Date objects.
  return rentalsData.map(rental => ({
    ...rental,
    rentalDate: new Date(rental.rentalDate),
    returnDate: new Date(rental.returnDate),
  }));
};

// --- Data Mutation Functions ---

export const addDumpster = async (dumpster: Omit<Dumpster, 'id'>) => {
  const currentData = await getDumpsters();
  const newDumpster = { ...dumpster, id: String(Date.now()) };
  await db.write('dumpsters', [...currentData, newDumpster]);
  return newDumpster;
};

export const updateDumpster = async (dumpster: Partial<Dumpster>, partial = false) => {
  const currentData = await getDumpsters();
  let updatedData;
  if (partial) {
    const existingDumpster = currentData.find(d => d.id === dumpster.id);
    if (!existingDumpster) throw new Error("Caçamba não encontrada");
    const updatedDumpster = { ...existingDumpster, ...dumpster };
    updatedData = currentData.map(d => (d.id === dumpster.id ? updatedDumpster : d));
  } else {
    updatedData = currentData.map(d => (d.id === dumpster.id ? dumpster : d));
  }
  await db.write('dumpsters', updatedData);
  return dumpster;
}

export const deleteDumpster = async (id: string) => {
    const [currentDumpsters, currentRentals] = await Promise.all([getDumpsters(), getRentals()]);
    const dumpster = currentDumpsters.find(d => d.id === id);

    if (dumpster?.status === 'Alugada') {
        throw new Error('Não é possível excluir uma caçamba que está atualmente alugada.');
    }

    const updatedData = currentDumpsters.filter(d => d.id !== id);
    await db.write('dumpsters', updatedData);
    return { success: true };
}


export const addClient = async (client: Omit<Client, 'id'>) => {
  const currentData = await getClients();
  const newClient = { ...client, id: String(Date.now()) };
  await db.write('clients', [...currentData, newClient]);
  return newClient;
};

export const updateClient = async (client: Client) => {
  const currentData = await getClients();
  const updatedData = currentData.map(c => (c.id === client.id ? client : c));
  await db.write('clients', updatedData);
  return client;
}

export const deleteClient = async (id: string) => {
    const [currentClients, currentRentals] = await Promise.all([getClients(), getRentals()]);
    const hasActiveRentals = currentRentals.some(r => r.clientId === id && r.status === 'Ativo');
    if (hasActiveRentals) {
        throw new Error('Não é possível excluir um cliente com aluguéis ativos. Finalize os aluguéis primeiro.');
    }
    const updatedData = currentClients.filter(c => c.id !== id);
    await db.write('clients', updatedData);
    return { success: true };
}


export const addRental = async (rental: Omit<Rental, 'id'>) => {
  const newRental = { ...rental, id: String(Date.now()) };

  const currentRentals = await getRentals();
  await db.write('rentals', [...currentRentals, newRental]);

  const currentDumpsters = await getDumpsters();
  const updatedDumpsters = currentDumpsters.map(d =>
    d.id === rental.dumpsterId ? { ...d, status: 'Alugada' } : d
  );
  await db.write('dumpsters', updatedDumpsters);
  
  return newRental;
};

export const updateRental = async (rental: Partial<Rental>) => {
    const currentRentals = await getRentals();
    const existingRental = currentRentals.find(r => r.id === rental.id);
    if (!existingRental) {
        throw new Error('Aluguel não encontrado.');
    }
    if (rental.returnDate && rental.returnDate < existingRental.rentalDate) {
        throw new Error('A data de devolução não pode ser anterior à data de aluguel.');
    }
    const updatedRental = { ...existingRental, ...rental };
    const updatedData = currentRentals.map(r => (r.id === rental.id ? updatedRental : r));
    await db.write('rentals', updatedData);
    return updatedRental;
};


export const completeRental = async (rentalId: string, dumpsterId: string) => {
  const currentRentals = await getRentals();
  const updatedRentals = currentRentals.map(r => 
    r.id === rentalId ? { ...r, status: 'Concluído' } : r
  );
  await db.write('rentals', updatedRentals);

  const currentDumpsters = await getDumpsters();
  const updatedDumpsters = currentDumpsters.map(d => 
    d.id === dumpsterId ? { ...d, status: 'Disponível' } : d
  );
  await db.write('dumpsters', updatedDumpsters);
  
  const rentals = await getRentals();
  const updatedRental = rentals.find(r => r.id === rentalId);
  return updatedRental;
};
