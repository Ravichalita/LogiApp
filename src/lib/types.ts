
import { z } from 'zod';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

const toNumOrNull = (v: unknown) => v === '' || v == null ? null : Number(v);

export const DUMPSTER_COLORS = {
  'Amarelo': { value: '#FFC700', description: 'Metal em geral' },
  'Azul': { value: '#007BFF', description: 'Papel; papelão' },
  'Branco': { value: '#FFFFFF', description: 'Resíduos ambulatoriais e de serviços de saúde' },
  'Cinza': { value: '#6c757d', description: 'Resíduo geral não reciclável ou misto' },
  'Laranja': { value: '#FD7E14', description: 'Resíduos perigosos' },
  'Marrom': { value: '#A52A2A', description: 'Resíduos orgânicos' },
  'Preto': { value: '#000000', description: 'Madeira' },
  'Roxo': { value: '#6F42C1', description: 'Resíduos radioativos' },
  'Verde': { value: '#28A745', description: 'Vidro' },
  'Vermelho': { value: '#DC3545', description: 'Plástico' },
} as const;

export type DumpsterColor = keyof typeof DUMPSTER_COLORS;

// #region Account

export const RentalPriceSchema = z.object({
  id: z.string(),
  name: z.string().min(1, { message: "O nome da tabela de preço é obrigatório." }),
  value: z.coerce.number().min(0, "O valor deve ser zero ou maior."),
});

export type RentalPrice = z.infer<typeof RentalPriceSchema>;

export const UploadedImageSchema = z.object({
  url: z.string().url(),
  path: z.string(),
});
export type UploadedImage = z.infer<typeof UploadedImageSchema>;

export const OperationTypeSchema = z.object({
  id: z.string(),
  name: z.string().min(1, { message: "O nome do tipo de operação é obrigatório." }),
  value: z.coerce.number().min(0, "O valor deve ser zero ou maior."),
});
export type OperationType = z.infer<typeof OperationTypeSchema>;

export const TruckTypeSchema = z.object({
  id: z.string(),
  name: z.string().min(1, { message: "O nome do tipo de caminhão é obrigatório." }),
});
export type TruckType = z.infer<typeof TruckTypeSchema>;

export const BaseSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "O nome da base é obrigatório."),
  address: z.string().min(5, { message: "O endereço deve ter pelo menos 5 caracteres." }),
  latitude: z.preprocess(toNumOrNull, z.number().min(-90).max(90).nullable()).optional(),
  longitude: z.preprocess(toNumOrNull, z.number().min(-180).max(180).nullable()).optional(),
});
export type Base = z.infer<typeof BaseSchema>;

export const OperationalCostSchema = z.object({
  id: z.string(),
  baseId: z.string().min(1, "A base é obrigatória."),
  truckTypeId: z.string().min(1, "O tipo de caminhão é obrigatório."),
  value: z.coerce.number().min(0, "O valor deve ser zero ou maior."),
});
export type OperationalCost = z.infer<typeof OperationalCostSchema>;

// #region Finance
export const TransactionCategorySchema = z.object({
  id: z.string(),
  name: z.string().min(1, "O nome da categoria é obrigatório."),
  type: z.enum(['income', 'expense']),
  color: z.string().optional(),
  isDefault: z.boolean().optional(),
});
export type TransactionCategory = z.infer<typeof TransactionCategorySchema>;

export const TransactionSchema = z.object({
  description: z.string().min(1, "A descrição é obrigatória."),
  amount: z.coerce.number(),
  type: z.enum(['income', 'expense']),
  status: z.enum(['pending', 'paid', 'overdue', 'cancelled']),
  dueDate: z.string(), // ISO String
  paymentDate: z.string().optional(), // ISO String
  categoryId: z.string().optional(),
  source: z.enum(['manual', 'service']).default('manual'),
  relatedResourceId: z.string().optional(), // ID of the rental or operation
  accountId: z.string(),
  createdAt: z.custom<FieldValue>().optional(),
});
export type Transaction = z.infer<typeof TransactionSchema> & { id: string };

export const UpdateTransactionSchema = TransactionSchema.partial().extend({
  id: z.string(),
});
// #endregion

export const AccountSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  rentalCounter: z.number().int().optional().default(0),
  operationCounter: z.number().int().optional().default(0),
  rentalPrices: z.array(RentalPriceSchema).optional().default([]),
  operationTypes: z.array(OperationTypeSchema).optional().default([]),
  truckTypes: z.array(TruckTypeSchema).optional().default([]),
  notificationImages: z.array(UploadedImageSchema).optional().default([]),
  lastBackupDate: z.string().optional(),
  backupPeriodicityDays: z.number().int().min(1).optional().default(7),
  backupRetentionDays: z.number().int().min(1).optional().default(90),
  bases: z.array(BaseSchema).optional().default([]),
  operationalCosts: z.array(OperationalCostSchema).optional().default([]),
  financialCategories: z.array(TransactionCategorySchema).optional().default([]),
});
export type Account = z.infer<typeof AccountSchema>;

export const UpdateBackupSettingsSchema = z.object({
  backupPeriodicityDays: z.coerce.number().int().min(1, "A periodicidade deve ser de no mínimo 1 dia."),
  backupRetentionDays: z.coerce.number().int().min(1, "A retenção deve ser de no mínimo 1 dia."),
});

export const UpdateBasesSchema = z.object({
  bases: z.array(BaseSchema).optional().default([]),
});

export const UpdateOperationalCostsSchema = z.object({
  operationalCosts: z.array(OperationalCostSchema).optional().default([]),
});


// #endregion


// #region Permissions
export const PermissionsSchema = z.object({
  // Main screen access
  canAccessRentals: z.boolean().default(true),
  canAccessOperations: z.boolean().default(false),
  canAccessRoutes: z.boolean().default(false),
  canAccessClients: z.boolean().default(true),
  canAccessDumpsters: z.boolean().default(true),
  canAccessFleet: z.boolean().default(false),
  canAccessTeam: z.boolean().default(false),
  canAccessSettings: z.boolean().default(false),

  // Feature Access
  canAccessFinance: z.boolean().default(false),
  canSeeServiceValue: z.boolean().default(false),
  canAccessNotificationsStudio: z.boolean().default(false),
  canUseAttachments: z.boolean().default(false),

  // Actions Access
  canEditRentals: z.boolean().default(false),
  canEditOperations: z.boolean().default(false),
  canEditDumpsters: z.boolean().default(false),
  canEditFleet: z.boolean().default(false),
  canAddClients: z.boolean().default(true), // New permission
  canEditClients: z.boolean().default(false),
}).default({});

export type Permissions = z.infer<typeof PermissionsSchema>;
// #endregion

// #region Backup
export const BackupSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  createdAt: z.string(), // Serialized as ISO string
  status: z.enum(['in-progress', 'completed', 'failed']),
});
export type Backup = z.infer<typeof BackupSchema>;
// #endregion

// #region Truck Schema
export const TruckSchema = z.object({
  name: z.string().min(1, { message: "O nome/identificador é obrigatório." }),
  plate: z.string().min(1, "A placa é obrigatória.").max(8, { message: "A placa deve ter no máximo 8 caracteres." }),
  type: z.string({ required_error: "O tipo de caminhão é obrigatório." }),
  year: z.preprocess(toNumOrNull, z.number().nullable()),
  status: z.enum(['Disponível', 'Em Manutenção', 'Em Operação']).default('Disponível'),
});
export type Truck = z.infer<typeof TruckSchema> & { id: string, accountId: string };

export const UpdateTruckSchema = TruckSchema.extend({
  id: z.string(),
});
// #endregion

export const AttachmentSchema = z.object({
  url: z.string().url(),
  name: z.string(),
  type: z.string(),
  uploadedAt: z.string(),
  path: z.string(),
});
export type Attachment = z.infer<typeof AttachmentSchema>;

// #region Operation Schema
export const AdditionalCostSchema = z.object({
  id: z.string(),
  name: z.string(),
  value: z.number(),
});
export type AdditionalCost = z.infer<typeof AdditionalCostSchema>;

const BaseOperationSchema = z.object({
  typeIds: z.array(z.string()).min(1, "Pelo menos um tipo de operação deve ser selecionado."),
  status: z.enum(['Pendente', 'Em Andamento', 'Concluído']),
  startDate: z.string({ required_error: "A data de início é obrigatória." }),
  endDate: z.string({ required_error: "A data de término é obrigatória." }),
  clientId: z.string({ required_error: "O cliente é obrigatório." }),
  truckId: z.string().optional(),
  driverId: z.string({ required_error: "O responsável é obrigatório." }),
  startAddress: z.string().min(5, { message: "O endereço de saída é obrigatório." }),
  startLatitude: z.preprocess(toNumOrNull, z.number().min(-90).max(90).nullable()).optional(),
  startLongitude: z.preprocess(toNumOrNull, z.number().min(-180).max(180).nullable()).optional(),
  destinationAddress: z.string().min(5, { message: "O endereço de destino é obrigatório." }),
  destinationLatitude: z.preprocess(toNumOrNull, z.number().min(-90).max(90).nullable()).optional(),
  destinationLongitude: z.preprocess(toNumOrNull, z.number().min(-180).max(180).nullable()).optional(),
  destinationGoogleMapsLink: z.string().url({ message: "Por favor, insira um link válido do Google Maps." }).optional().or(z.literal('')),
  observations: z.string().optional(),
  value: z.coerce.number().optional().nullable(),
  additionalCosts: z.array(AdditionalCostSchema).optional(),
  travelCost: z.number().optional(),
  totalCost: z.number().optional(),
  createdBy: z.string(),
  accountId: z.string(),
  createdAt: z.custom<FieldValue>().optional(),
  attachments: z.array(AttachmentSchema).optional(),
  recurrenceProfileId: z.string().optional(),
  billingType: z.enum(['perService', 'monthly']).optional().default('perService'),
});

export const OperationSchema = BaseOperationSchema.extend({
  sequentialId: z.number().int().positive(),
  googleCalendarEventId: z.string().optional(),
}).refine(data => {
  if (data.startDate && data.endDate) {
    return new Date(data.endDate) >= new Date(data.startDate);
  }
  return true;
}, {
  message: "A data de término deve ser posterior ou igual à data de início.",
  path: ["endDate"],
});

export const UpdateOperationSchema = BaseOperationSchema
  .omit({
    createdBy: true,
    accountId: true,
    createdAt: true,
    status: true
  })
  .extend({ id: z.string() })
  .partial()
  .refine(data => {
    if (data.startDate && data.endDate) {
      return new Date(data.endDate) >= new Date(data.startDate);
    }
    return true;
  }, {
    message: "A data de término deve ser posterior ou igual à data de início.",
    path: ["endDate"],
  });


export type Operation = z.infer<typeof OperationSchema> & { id: string };

export const CompletedOperationSchema = BaseOperationSchema.extend({
  sequentialId: z.number().int().positive(),
  completedAt: z.custom<FieldValue | Timestamp | string>(),
  parentOperationId: z.string().optional(),
  originalOperationId: z.string().optional(),
});

export type CompletedOperation = z.infer<typeof CompletedOperationSchema> & { id: string, completedAt: string };

// #endregion


// #region Base Schemas
export const ClientSchema = z.object({
  name: z.string().min(3, { message: "O nome deve ter pelo menos 3 caracteres." }),
  phone: z.string().min(10, { message: "O telefone deve ter pelo menos 10 caracteres." }),
  cpfCnpj: z.string().optional(),
  email: z.string().email({ message: "Formato de e-mail inválido." }).optional().or(z.literal('')),
  address: z.string().min(5, { message: "O endereço deve ter pelo menos 5 caracteres." }),
  latitude: z.preprocess(toNumOrNull, z.number().min(-90).max(90).nullable()).optional(),
  longitude: z.preprocess(toNumOrNull, z.number().min(-180).max(180).nullable()).optional(),
  googleMapsLink: z.string().url({ message: "Por favor, insira um link válido do Google Maps." }).optional().or(z.literal('')),
  observations: z.string().optional(),
});

export const UpdateClientSchema = ClientSchema.extend({
  id: z.string(),
}).partial(); // Make all fields optional for updates


export const DumpsterSchema = z.object({
  name: z.string().min(1, { message: "O nome é obrigatório." }),
  color: z.enum(Object.keys(DUMPSTER_COLORS) as [DumpsterColor, ...DumpsterColor[]], {
    required_error: "A cor é obrigatória.",
  }),
  size: z.coerce.number().positive({ message: "O tamanho deve ser um número positivo." }),
  status: z.enum(['Disponível', 'Em Manutenção'], {
    errorMap: () => ({ message: "Status inválido." }),
  }),
});

export const UpdateDumpsterSchema = DumpsterSchema.extend({
  id: z.string(),
});


export const RentalSchema = z.object({
  sequentialId: z.number().int().positive(),
  dumpsterIds: z.array(z.string()).min(1, { message: "Selecione pelo menos uma caçamba." }),
  clientId: z.string({ required_error: "Selecione um cliente." }),
  truckId: z.string().optional(),
  rentalDate: z.string({ required_error: "A data de entrega é obrigatória." }),
  returnDate: z.string({ required_error: "A data de retirada é obrigatória." }),
  swapDate: z.string().optional(),
  startAddress: z.string().min(5, { message: "O endereço de partida é obrigatório." }),
  startLatitude: z.preprocess(toNumOrNull, z.number().min(-90).max(90).nullable()).optional(),
  startLongitude: z.preprocess(toNumOrNull, z.number().min(-180).max(180).nullable()).optional(),
  deliveryAddress: z.string().min(5, { message: "O endereço de entrega deve ter pelo menos 5 caracteres." }),
  deliveryGoogleMapsLink: z.string().url({ message: "Por favor, insira um link válido do Google Maps." }).optional().or(z.literal('')),
  latitude: z.preprocess(toNumOrNull, z.number().min(-90).max(90).nullable()).optional(),
  longitude: z.preprocess(toNumOrNull, z.number().min(-180).max(180).nullable()).optional(),
  billingType: z.enum(['perDay', 'lumpSum']),
  value: z.coerce.number({ required_error: "O valor é obrigatório." }).min(0, "O valor deve ser zero ou maior."),
  lumpSumValue: z.coerce.number().min(0, "O valor deve ser zero ou maior.").optional(),
  status: z.enum(['Pendente', 'Ativo', 'Finalizado', 'Atrasado']),
  createdBy: z.string(),
  assignedTo: z.string({ required_error: "É necessário designar um responsável." }),
  observations: z.string().optional(),
  notificationsSent: z.object({
    due: z.boolean().default(false),
    late: z.boolean().default(false),
  }).optional(),
  accountId: z.string(),
  attachments: z.array(AttachmentSchema).optional(),
  additionalCosts: z.array(AdditionalCostSchema).optional(),
  travelCost: z.number().optional(),
  totalCost: z.number().optional(),
  googleCalendarEventId: z.string().optional(),
  googleCalendarSwapEventId: z.string().optional(),
  recurrenceProfileId: z.string().optional(),
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
  swapDate: z.string().optional().nullable(),
  startAddress: z.string().min(5, { message: "O endereço de partida é obrigatório." }).optional(),
  startLatitude: z.preprocess(toNumOrNull, z.number().min(-90).max(90).nullable()).optional(),
  startLongitude: z.preprocess(toNumOrNull, z.number().min(-180).max(180).nullable()).optional(),
  deliveryAddress: z.string().min(5, { message: "O endereço de entrega deve ter pelo menos 5 caracteres." }).optional(),
  deliveryGoogleMapsLink: z.string().url({ message: "Por favor, insira um link válido do Google Maps." }).optional().or(z.literal('')),
  latitude: z.preprocess(toNumOrNull, z.number().min(-90).max(90).nullable()).optional(),
  longitude: z.preprocess(toNumOrNull, z.number().min(-180).max(180).nullable()).optional(),
  value: z.preprocess(
    (val) => (typeof val === 'string' ? val.replace(',', '.') : val),
    z.coerce.number().min(0, "O valor deve ser zero ou maior.")
  ).optional(),
  assignedTo: z.string().optional(),
  truckId: z.string().optional(),
  observations: z.string().optional(),
  attachments: z.array(AttachmentSchema).optional(),
  additionalCosts: z.array(AdditionalCostSchema).optional(),
  billingType: z.enum(['perDay', 'lumpSum']).optional(),
  lumpSumValue: z.coerce.number().min(0).optional(),
  travelCost: z.number().optional(),
  totalCost: z.number().optional(),
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
  parentRentalId: z.string().optional(),
});


export const UserAccountSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(['superadmin', 'owner', 'admin', 'viewer']),
  status: z.enum(['ativo', 'inativo']),
  permissions: PermissionsSchema,
  phone: z.string().optional(),
  phone2: z.string().optional(),
  createdAt: z.custom<FieldValue>().optional(),
  fcmTokens: z.array(z.string()).optional(),
  hasSeenWelcome: z.boolean().optional(),
  firstAccessAt: z.string().optional(),
  googleCalendar: z.object({
    accessToken: z.string(),
    expiryDate: z.number(),
    refreshToken: z.string(),
    calendarId: z.string().optional(),
  }).optional(),
  avatarUrl: z.string().url().optional(),
  avatarPath: z.string().optional(),
  personType: z.enum(['fisica', 'juridica']).default('fisica'),
  companyName: z.string().optional(),
  cpf: z.string().optional(),
  cnpj: z.string().optional(),
  address: z.string().optional(),
  addressNumber: z.string().optional(),
  addressComplement: z.string().optional(),
  addressDistrict: z.string().optional(),
  addressCity: z.string().optional(),
  addressState: z.string().optional(),
  addressZipCode: z.string().optional(),
});

export const UpdateUserProfileSchema = z.object({
  name: z.string().min(3, { message: "O nome deve ter pelo menos 3 caracteres." }).optional(),
  avatarUrl: z.string().url().optional(),
  avatarPath: z.string().optional(),
  phone: z.string().optional(),
  phone2: z.string().optional(),
  personType: z.enum(['fisica', 'juridica']),
  companyName: z.string().optional(),
  cpf: z.string().optional(),
  cnpj: z.string().optional(),
  address: z.string().optional(),
  addressNumber: z.string().optional(),
  addressComplement: z.string().optional(),
  addressDistrict: z.string().optional(),
  addressCity: z.string().optional(),
  addressState: z.string().optional(),
  addressZipCode: z.string().optional(),
});

const BaseSignupSchema = z.object({
  name: z.string().min(3, { message: 'O nome deve ter pelo menos 3 caracteres.' }),
  email: z.string().email({ message: 'Por favor, insira um e-mail válido.' }),
  password: z.string().min(6, { message: 'A senha deve ter pelo menos 6 caracteres.' }),
});

export const SignupSchema = BaseSignupSchema
  .extend({
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem.',
    path: ['confirmPassword'],
  });

export const SuperAdminCreationSchema = BaseSignupSchema;


// #region Recurrence
export const RecurrenceProfileSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  frequency: z.enum(['weekly', 'custom']), // Simplified for now, can be expanded
  daysOfWeek: z.array(z.number().min(0).max(6)), // 0 = Sunday, 1 = Monday, etc.
  time: z.string(), // HH:mm
  endDate: z.string().optional(), // ISO string, if null/undefined = indefinite
  billingType: z.enum(['perService', 'monthly']),
  monthlyValue: z.number().optional(),
  status: z.enum(['active', 'cancelled', 'completed']),
  createdAt: z.custom<FieldValue>(),
  lastGeneratedAt: z.custom<FieldValue>().optional(),
  nextRunAt: z.custom<FieldValue>().optional(),
  nextRunDate: z.string().optional(),
  originalOrderId: z.string(), // The ID of the first OS that created this profile
  type: z.enum(['rental', 'operation']),
  templateData: z.any().optional(),
});
export type RecurrenceProfile = z.infer<typeof RecurrenceProfileSchema>;
// #endregion

export const RentalPricesSchema = z.object({
  rentalPrices: z.array(RentalPriceSchema).optional().default([]),
});

// #endregion


// #region TypeScript Types
export type Client = z.infer<typeof ClientSchema> & { id: string, createdAt: any };
export type Dumpster = z.infer<typeof DumpsterSchema> & { id: string, accountId: string };
export type DumpsterStatus = Dumpster['status'];
export type Rental = z.infer<typeof RentalSchema> & { id: string, truckId?: string, swapDate?: string, googleCalendarEventId?: string, googleCalendarSwapEventId?: string };
export type CompletedRental = Omit<z.infer<typeof CompletedRentalSchema>, 'completedDate'> & {
  id: string;
  completedDate: string; // Serialized as ISO string
  accountId: string;
  client?: Client | null;
  dumpsters?: Dumpster[] | null; // Changed from dumpster to dumpsters
  assignedToUser?: UserAccount | null;
  attachments?: z.infer<typeof AttachmentSchema>[];
};
export type UserAccount = z.infer<typeof UserAccountSchema>;
export type UserRole = UserAccount['role'];
export type UserStatus = UserAccount['status'];
export type Location = { lat: number; lng: number; address: string; };

// Derived/Enhanced Types for UI
export type DerivedDumpsterStatus = 'Disponível' | 'Alugada' | 'Em Manutenção' | 'Reservada' | 'Encerra hoje' | 'Em Atraso';
export type EnhancedDumpster = Dumpster & { derivedStatus: string, scheduledRentals: PopulatedRental[] };
export type PopulatedRental = Omit<Rental, 'clientId' | 'assignedTo'> & {
  id: string;
  itemType: 'rental';
  truck?: Truck | null;
  dumpsters: Dumpster[] | null;
  client: Client | null;
  assignedToUser: UserAccount | null;
  swapDate?: string;
  googleCalendarEventId?: string;
  googleCalendarSwapEventId?: string;
};
export type PopulatedOperation = Operation & {
  id: string;
  itemType: 'operation';
  operationTypes: { id: string, name: string }[];
  client: Client | null;
  truck: Truck | null;
  driver: UserAccount | null;
  createdAt?: Timestamp | string; // Allow string for serialized data
  completedAt?: string; // Serialized ISO string for completed operations
};
export type PopulatedCompletedRental = Omit<CompletedRental, 'clientId'> & {
  id: string;
  client: Client | null;
};
export type AdminClientView = {
  accountId: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  ownerStatus: UserStatus;
  hasSeenWelcome: boolean;
  createdAt: string;
  firstAccessAt?: string;
  members: UserAccount[];
}

export type HistoricItem = {
  id: string;
  kind: 'rental' | 'operation';
  prefix: 'AL' | 'OP';
  clientName: string;
  completedDate: string;
  totalValue: number;
  sequentialId: number;
  operationTypeName?: string | null; // Keep for backward compatibility in historic items view
  operationTypes?: { id: string, name: string }[]; // For new items
  data: CompletedRental | PopulatedOperation;
};
// #endregion
