
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';

const toNumOrUndef = (v: unknown) => v === '' || v == null ? undefined : Number(v);

// #region Account

export const RentalPriceSchema = z.object({
  id: z.string(),
  name: z.string().min(1, { message: "O nome da tabela de preço é obrigatório." }),
  value: z.coerce.number().min(0, "O valor deve ser zero ou maior."),
});

export type RentalPrice = z.infer<typeof RentalPriceSchema>;

export const AccountSchema = z.object({
    id: z.string(),
    ownerId: z.string(),
    rentalPrices: z.array(RentalPriceSchema).optional().default([]),
});
export type Account = z.infer<typeof AccountSchema>;

// #endregion


// #region Permissions
export const PermissionsSchema = z.object({
    canAccessTeam: z.boolean().default(false),
    canAccessFinance: z.boolean().default(false),
    canEditClients: z.boolean().default(false),
    canEditDumpsters: z.boolean().default(false),
    canEditRentals: z.boolean().default(false),
}).default({});

export type Permissions = z.infer<typeof PermissionsSchema>;
// #endregion

// #region Base Schemas
export const ClientSchema = z.object({
  name: z.string().min(3, { message: "O nome deve ter pelo menos 3 caracteres." }),
  phone: z.string().min(10, { message: "O telefone deve ter pelo menos 10 caracteres." }),
  email: z.string().email({ message: "Formato de e-mail inválido." }).optional().or(z.literal('')),
  address: z.string().min(5, { message: "O endereço deve ter pelo menos 5 caracteres." }),
  latitude: z.preprocess(toNumOrUndef, z.number().min(-90).max(90)).optional(),
  longitude: z.preprocess(toNumOrUndef, z.number().min(-180).max(180)).optional(),
  observations: z.string().optional(),
});

export const UpdateClientSchema = ClientSchema.extend({
  id: z.string(),
});


export const DumpsterSchema = z.object({
    name: z.string().min(1, { message: "O nome é obrigatório."}),
    color: z.string().min(1, { message: "A cor é obrigatória."}),
    size: z.coerce.number().positive({ message: "O tamanho deve ser um número positivo."}),
    status: z.enum(['Disponível', 'Em Manutenção'], {
        errorMap: () => ({ message: "Status inválido." }),
    }),
});

export const UpdateDumpsterSchema = DumpsterSchema.extend({
  id: z.string(),
});


export const RentalSchema = z.object({
  dumpsterId: z.string({ required_error: "Selecione uma caçamba." }),
  clientId: z.string({ required_error: "Selecione um cliente." }),
  rentalDate: z.string({ required_error: "A data de entrega é obrigatória." }),
  returnDate: z.string({ required_error: "A data de retirada é obrigatória." }),
  deliveryAddress: z.string().min(5, { message: "O endereço deve ter pelo menos 5 caracteres." }),
  latitude: z.preprocess(toNumOrUndef, z.number().min(-90).max(90)).optional(),
  longitude: z.preprocess(toNumOrUndef, z.number().min(-180).max(180)).optional(),
  value: z.coerce.number().positive({ message: "O valor deve ser positivo." }),
  status: z.enum(['Pendente', 'Ativo', 'Finalizado', 'Atrasado']),
  createdBy: z.string(),
  assignedTo: z.string({ required_error: "É necessário designar um responsável."}),
});

const UpdateRentalPeriodSchema = z.object({
  id: z.string(),
  rentalDate: z.string({ required_error: "A data de entrega é obrigatória." }),
  returnDate: z.string({ required_error: "A data de retirada é obrigatória." }),
}).refine(data => new Date(data.returnDate) > new Date(data.rentalDate), {
  message: "A data de retirada deve ser posterior à data de entrega.",
  path: ["returnDate"],
});

export const UpdateRentalSchema = z.object({
    id: z.string(),
    rentalDate: z.string().optional(),
    returnDate: z.string().optional(),
    deliveryAddress: z.string().min(5, { message: "O endereço deve ter pelo menos 5 caracteres." }).optional(),
    latitude: z.preprocess(toNumOrUndef, z.number().min(-90).max(90)).optional(),
    longitude: z.preprocess(toNumOrUndef, z.number().min(-180).max(180)).optional(),
    value: z.coerce.number().positive({ message: "O valor deve ser positivo." }).optional(),
}).refine(data => {
    if (data.rentalDate && data.returnDate) {
        return new Date(data.returnDate) > new Date(data.rentalDate);
    }
    return true;
}, {
    message: "A data de retirada deve ser posterior à data de entrega.",
    path: ["returnDate"],
});


export const CompletedRentalSchema = RentalSchema.extend({
    originalRentalId: z.string(),
    completedDate: z.custom<FieldValue>(),
    rentalDays: z.number().positive(),
    totalValue: z.number().positive(),
});


export const UserAccountSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(['admin', 'viewer']),
  status: z.enum(['ativo', 'inativo']),
  permissions: PermissionsSchema,
});

export const SignupSchema = z
  .object({
    name: z.string().min(3, { message: 'O nome deve ter pelo menos 3 caracteres.' }),
    email: z.string().email({ message: 'Por favor, insira um e-mail válido.' }),
    password: z.string().min(6, { message: 'A senha deve ter pelo menos 6 caracteres.' }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem.',
    path: ['confirmPassword'],
  });

export const RentalPricesSchema = z.object({
    rentalPrices: z.array(RentalPriceSchema).optional().default([]),
});

// #endregion


// #region TypeScript Types
export type Client = z.infer<typeof ClientSchema> & { id: string, accountId: string };
export type Dumpster = z.infer<typeof DumpsterSchema> & { id: string, accountId: string };
export type DumpsterStatus = Dumpster['status'];
export type Rental = z.infer<typeof RentalSchema> & { id: string, accountId: string };
// Make completedDate a string to allow for serialization from server component
export type CompletedRental = Omit<z.infer<typeof CompletedRentalSchema>, 'completedDate'> & { 
    id: string; 
    completedDate: string; // Serialized as ISO string
    accountId: string;
    assignedToUser?: UserAccount | null;
};
export type UserAccount = z.infer<typeof UserAccountSchema>;
export type UserRole = UserAccount['role'];
export type UserStatus = UserAccount['status'];
export type Location = { lat: number; lng: number; address: string; };

// Derived/Enhanced Types for UI
export type DerivedDumpsterStatus = 'Disponível' | 'Alugada' | 'Em Manutenção' | 'Reservada';
export type EnhancedDumpster = Dumpster & { derivedStatus: string };
export type PopulatedRental = Omit<Rental, 'dumpsterId' | 'clientId' | 'assignedTo'> & {
    id: string;
    dumpster: Dumpster | null;
    client: Client | null;
    assignedToUser: UserAccount | null;
};
export type PopulatedCompletedRental = Omit<CompletedRental, 'dumpsterId' | 'clientId'> & {
    id: string;
    dumpster: Dumpster | null;
    client: Client | null;
};
// #endregion
