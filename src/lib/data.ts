// In a real application, this data would be stored in a database.
// For this demo, we're using an in-memory store. This data will reset on server restart.
import type { Dumpster, Client, Rental } from './types';

let dumpsters: Dumpster[] = [
  { id: '1', name: 'Caçamba 01', status: 'Disponível' },
  { id: '2', name: 'Caçamba 02', status: 'Disponível' },
  { id: '3', name: 'Caçamba Amarela 03', status: 'Alugada' },
  { id: '4', name: 'Caçamba 04', status: 'Em Manutenção' },
  { id: '5', name: 'Caçamba Azul 05', status: 'Alugada' },
  { id: '6', name: 'Caçamba Verde 06', status: 'Disponível' },
];

let clients: Client[] = [
  { id: '1', name: 'João da Silva Construções', phone: '(11) 98765-4321', address: 'Rua das Flores, 123, São Paulo, SP' },
  { id: '2', name: 'Maria Souza Reformas', phone: '(21) 91234-5678', address: 'Avenida Principal, 456, Rio de Janeiro, RJ' },
  { id: '3', name: 'Construtora Lajes & Pilares', phone: '(31) 99999-8888', address: 'Alameda dos Jacarandás, 789, Belo Horizonte, MG' },
];

let rentals: Rental[] = [
  { id: '1', dumpsterId: '3', clientId: '1', deliveryAddress: 'Rua das Flores, 123, São Paulo, SP', rentalDate: new Date('2024-07-15'), returnDate: new Date('2024-07-25'), status: 'Ativo' },
  { id: '2', dumpsterId: '5', clientId: '2', deliveryAddress: 'Avenida do Sol, 789, Angra dos Reis, RJ', rentalDate: new Date('2024-07-20'), returnDate: new Date('2024-07-30'), status: 'Ativo' },
];

// Functions to interact with the data
export const getDumpsters = async () => dumpsters;
export const getClients = async () => clients;
export const getRentals = async () => rentals;

export const addDumpster = async (dumpster: Omit<Dumpster, 'id'>) => {
  const newDumpster = { ...dumpster, id: String(Date.now()) };
  dumpsters.push(newDumpster);
  return newDumpster;
};

export const addClient = async (client: Omit<Client, 'id'>) => {
  const newClient = { ...client, id: String(Date.now()) };
  clients.push(newClient);
  return newClient;
};

export const addRental = async (rental: Omit<Rental, 'id'>) => {
  const newRental = { ...rental, id: String(Date.now()) };
  rentals.push(newRental);
  const dumpster = dumpsters.find(d => d.id === rental.dumpsterId);
  if (dumpster) {
    dumpster.status = 'Alugada';
  }
  return newRental;
};

export const completeRental = async (rentalId: string) => {
  const rental = rentals.find(r => r.id === rentalId);
  if (rental) {
    rental.status = 'Concluído';
    const dumpster = dumpsters.find(d => d.id === rental.dumpsterId);
    if (dumpster) {
      dumpster.status = 'Disponível';
    }
  }
  return rental;
};
