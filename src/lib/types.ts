export type DumpsterStatus = "Disponível" | "Alugada" | "Em Manutenção";

export interface FirestoreEntity {
  id: string;
}

export interface Dumpster extends FirestoreEntity {
  name: string;
  status: DumpsterStatus;
  color: string;
  size: number;
}

export interface Client extends FirestoreEntity {
  name: string;
  phone: string;
  address: string;
  email?: string;
  observations?: string;
  latitude?: number;
  longitude?: number;
}

export interface Rental extends FirestoreEntity {
  dumpsterId: string;
  clientId: string;
  deliveryAddress: string;
  latitude?: number;
  longitude?: number;
  rentalDate: Date;
  returnDate: Date;
  status: "Ativo" | "Concluído";
  value: number; // Daily value
}

export interface PopulatedRental extends Rental {
  dumpster: Dumpster;
  client: Client;
}

export interface CompletedRental extends FirestoreEntity {
    dumpsterId: string;
    clientId: string;
    rentalDate: Date;
    returnDate: Date;
    completedDate: Date;
    totalValue: number;
    rentalDays: number;
}


export interface Location {
    address: string;
    lat: number;
    lng: number;
}
