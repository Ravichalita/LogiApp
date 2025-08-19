export type DumpsterStatus = "Disponível" | "Alugada" | "Em Manutenção";

export interface Dumpster {
  id: string;
  name: string;
  status: DumpsterStatus;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  address: string;
  email?: string;
  observations?: string;
}

export interface Rental {
  id: string;
  dumpsterId: string;
  clientId: string;
  deliveryAddress: string;
  latitude?: number;
  longitude?: number;
  rentalDate: Date;
  returnDate: Date;
  status: "Ativo" | "Concluído";
}

export interface PopulatedRental extends Rental {
  dumpster: Dumpster;
  client: Client;
}
