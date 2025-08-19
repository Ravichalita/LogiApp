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
  const newDumpster = { ...dumpster, id: String(Date.now()) };
  await db.write('dumpsters', (data) => [...data, newDumpster]);
  return newDumpster;
};

export const addClient = async (client: Omit<Client, 'id'>) => {
  const newClient = { ...client, id: String(Date.now()) };
  await db.write('clients', (data) => [...data, newClient]);
  return newClient;
};

export const addRental = async (rental: Omit<Rental, 'id'>) => {
  const newRental = { ...rental, id: String(Date.now()) };

  // Add the new rental
  await db.write('rentals', (data) => [...data, newRental]);

  // Update the dumpster status
  await db.write('dumpsters', (dumpsters: Dumpster[]) => 
    dumpsters.map(d =>
      d.id === rental.dumpsterId ? { ...d, status: 'Alugada' } : d
    )
  );
  
  return newRental;
};

export const completeRental = async (rentalId: string, dumpsterId: string) => {
  // Update rental status to 'Concluído'
  await db.write('rentals', (rentals: Rental[]) => 
    rentals.map(r => 
      r.id === rentalId ? { ...r, status: 'Concluído' } : r
    )
  );

  // Update dumpster status to 'Disponível'
  await db.write('dumpsters', (dumpsters: Dumpster[]) => 
    dumpsters.map(d => 
      d.id === dumpsterId ? { ...d, status: 'Disponível' } : d
    )
  );
  
  const rentals = await getRentals();
  const updatedRental = rentals.find(r => r.id === rentalId);
  return updatedRental;
};
