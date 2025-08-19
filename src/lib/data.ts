'use server';
import type { Dumpster, Client, Rental } from './types';
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

export const updateDumpster = async (dumpster: Dumpster) => {
  const currentData = await getDumpsters();
  const updatedData = currentData.map(d => (d.id === dumpster.id ? dumpster : d));
  await db.write('dumpsters', updatedData);
  return dumpster;
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
