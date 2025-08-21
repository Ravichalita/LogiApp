

export type UserRole = 'admin' | 'member';

export interface Account extends FirestoreEntity {
    name: string;
    ownerId: string;
}

export interface UserAccount extends FirestoreEntity {
    email: string;
    role: UserRole;
    accountId: string;
}

export type DumpsterStatus = "Disponível" | "Em Manutenção";
export type DerivedDumpsterStatus = DumpsterStatus | "Alugada" | `Reservada para ${string}`;


export interface FirestoreEntity {
  id: string;
}

export interface Dumpster extends FirestoreEntity {
  name: string;
  status: DumpsterStatus;
  color: string;
  size: number;
}

export interface EnhancedDumpster extends Dumpster {
    derivedStatus: DerivedDumpsterStatus;
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
  status: "Ativo";
  value: number; // Daily value
  assignedTo?: string; // UID of the user this rental is assigned to
}

export interface PopulatedRental extends Rental {
  dumpster: Dumpster;
  client: Client;
  assignedUser?: UserAccount;
}

export interface CompletedRental extends FirestoreEntity {
    dumpsterId: string;
    clientId: string;
    rentalDate: Date;
    returnDate: Date;
    completedDate: Date;
    totalValue: number;
    rentalDays: number;
    assignedTo?: string;
}

export interface PopulatedCompletedRental extends CompletedRental {
    dumpster?: Dumpster;
    client?: Client;
    assignedUser?: UserAccount;
}


export interface Location {
    address: string;
    lat: number;
    lng: number;
}
