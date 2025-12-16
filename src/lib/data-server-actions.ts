
'use server';

import { getFirestore, Timestamp, FieldPath } from 'firebase-admin/firestore';
import type { CompletedRental, Client, Dumpster, Account, UserAccount, Backup, AdminClientView, PopulatedRental, Rental, Attachment, Location, PopulatedOperation, CompletedOperation, OperationType, Truck, Transaction, TransactionCategory, Operation } from './types';
import { adminDb } from './firebase-admin';
import { differenceInDays, isSameDay, startOfMonth, endOfMonth, set, format } from 'date-fns';

// Helper to convert Timestamps to serializable format
const toSerializableObject = (obj: any): any => {
    if (obj == null) return obj;
    if (typeof obj !== 'object') return obj;

    if (obj.toDate && typeof obj.toDate === 'function') {
        return obj.toDate().toISOString();
    }
    
    if (Array.isArray(obj)) {
        return obj.map(toSerializableObject);
    }
    
    const newObj: { [key: string]: any } = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            newObj[key] = toSerializableObject(obj[key]);
        }
    }
    return newObj;
}

// Helper function to safely convert a Firestore document snapshot to a serializable object
const docToSerializable = (doc: FirebaseFirestore.DocumentSnapshot | null | undefined): any => {
  if (!doc || !doc.exists) {
    return null;
  }
  return toSerializableObject({ id: doc.id, ...doc.data() });
};

// #region Finance

export async function getTransactions(
    accountId: string,
    filtersOrMonth?: { month?: number, year?: number, startDate?: string, endDate?: string } | number,
    legacyYear?: number
): Promise<Transaction[]> {
    try {
        // Handle overload signatures
        let month: number | undefined;
        let year: number | undefined;
        let startDate: string | undefined;
        let endDate: string | undefined;

        if (typeof filtersOrMonth === 'number') {
            month = filtersOrMonth;
            year = legacyYear;
        } else if (filtersOrMonth) {
            month = filtersOrMonth.month;
            year = filtersOrMonth.year;
            startDate = filtersOrMonth.startDate;
            endDate = filtersOrMonth.endDate;
        }

        const transCol = adminDb.collection(`accounts/${accountId}/transactions`);
        let query = transCol.orderBy('dueDate', 'desc');

        if (startDate && endDate) {
             query = transCol
                .where('dueDate', '>=', startDate)
                .where('dueDate', '<=', endDate)
                .orderBy('dueDate', 'desc');
        } else if (month !== undefined && year !== undefined) {
            const date = set(new Date(), { year, month, date: 1 });
            // Use YYYY-MM-DD for start to include transactions created with just the date string (e.g. "2025-12-01")
            // "2025-12-01" < "2025-12-01T00:00:00.000Z", so ISOString() would exclude the 1st of the month if no time is present.
            const start = format(startOfMonth(date), 'yyyy-MM-dd');
            const end = endOfMonth(date).toISOString();

            query = transCol
                .where('dueDate', '>=', start)
                .where('dueDate', '<=', end)
                .orderBy('dueDate', 'desc');
        }

        const snap = await query.get();

        if (snap.empty) return [];

        return snap.docs.map(doc => toSerializableObject({ id: doc.id, ...doc.data() }) as Transaction);
    } catch (error) {
        console.error("Error fetching transactions:", error);
        return [];
    }
}

export async function getFinancialCategories(accountId: string): Promise<TransactionCategory[]> {
    try {
        const accountSnap = await adminDb.doc(`accounts/${accountId}`).get();
        if (!accountSnap.exists) return [];

        const data = accountSnap.data() as Account;
        return data.financialCategories || [];
    } catch (error) {
        console.error("Error fetching categories:", error);
        return [];
    }
}

// #endregion


export async function getCompletedRentals(accountId: string): Promise<CompletedRental[]> {
    try {
        const rentalsCol = adminDb.collection(`accounts/${accountId}/completed_rentals`);
        const rentalsSnap = await rentalsCol.orderBy('completedDate', 'desc').get();
        
        if (rentalsSnap.empty) {
            return [];
        }

        const populatedRentalsPromises = rentalsSnap.docs.map(async (doc) => {
             const rentalData = toSerializableObject({ id: doc.id, ...doc.data() }) as CompletedRental;
             const anyRentalData = rentalData as any;
             const dumpsterId = anyRentalData.dumpsterId; // Legacy support

             const dumpsterIds = rentalData.dumpsterIds || (dumpsterId ? [dumpsterId] : []);

             const [clientSnap, assignedToSnap, ...dumpsterSnaps] = await Promise.all([
                rentalData.clientId ? adminDb.doc(`accounts/${accountId}/clients/${rentalData.clientId}`).get() : Promise.resolve(null),
                rentalData.assignedTo ? adminDb.doc(`users/${rentalData.assignedTo}`).get() : Promise.resolve(null),
                ...dumpsterIds.map(id => adminDb.doc(`accounts/${accountId}/dumpsters/${id}`).get())
            ]);
            
            return {
                ...rentalData,
                client: docToSerializable(clientSnap),
                dumpsters: dumpsterSnaps.map(s => docToSerializable(s)).filter(Boolean),
                assignedToUser: docToSerializable(assignedToSnap),
            };
        });

        const populatedRentals = await Promise.all(populatedRentalsPromises);
        return populatedRentals as CompletedRental[];

    } catch (error) {
        console.error("Error fetching completed rentals:", error);
        return [];
    }
}

export async function getCompletedOperations(accountId: string): Promise<PopulatedOperation[]> {
    try {
        const accountSnap = await adminDb.doc(`accounts/${accountId}`).get();
        if (!accountSnap.exists) {
            console.error(`Account ${accountId} not found.`);
            return [];
        }
        const operationTypes = accountSnap.data()?.operationTypes as OperationType[] || [];
        const opTypeMap = new Map(operationTypes.map(t => [t.id, t.name]));

        const opsCol = adminDb.collection(`accounts/${accountId}/completed_operations`);
        const opsSnap = await opsCol.orderBy('completedAt', 'desc').get();
        
        if (opsSnap.empty) {
            return [];
        }

        const populatedOpsPromises = opsSnap.docs.map(async doc => {
            const opData = docToSerializable(doc) as CompletedOperation;
            
            const [clientSnap, truckSnap, driverSnap] = await Promise.all([
                opData.clientId ? adminDb.doc(`accounts/${accountId}/clients/${opData.clientId}`).get() : Promise.resolve(null),
                opData.truckId ? adminDb.doc(`accounts/${accountId}/trucks/${opData.truckId}`).get() : Promise.resolve(null),
                opData.driverId ? adminDb.doc(`users/${opData.driverId}`).get() : Promise.resolve(null),
            ]);

            const populatedTypes = (opData.typeIds || []).map(id => ({
                id,
                name: opTypeMap.get(id) || 'Tipo desconhecido'
            }));

            return {
                ...opData,
                itemType: 'operation' as const,
                id: doc.id,
                operationTypes: populatedTypes,
                client: clientSnap?.exists ? docToSerializable(clientSnap) : null,
                truck: truckSnap?.exists ? docToSerializable(truckSnap) : null,
                driver: driverSnap?.exists ? docToSerializable(driverSnap) : null,
            } as PopulatedOperation;
        });

        const populatedOps = await Promise.all(populatedOpsPromises);
        return populatedOps as any as PopulatedOperation[];

    } catch (error) {
        console.error("Error fetching completed operations:", error);
        return [];
    }
}


export async function getBackupsAction(accountId: string): Promise<Backup[]> {
    if (!accountId) {
        console.error("getBackupsAction called without accountId");
        return [];
    }
    try {
        const backupsCollection = adminDb.collection('backups');
        const q = backupsCollection.where('accountId', '==', accountId);
        const querySnapshot = await q.get();

        if (querySnapshot.empty) {
            return [];
        }
        
        const backups = querySnapshot.docs.map(doc => toSerializableObject({ id: doc.id, ...doc.data() }) as Backup);

        // Sort on the server before returning
        return backups.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
        });
    } catch (error) {
        console.error("Error fetching backups via server action:", error);
        // In case of error, return an empty array to the client instead of throwing
        return [];
    }
}

export async function getAllClientAccountsAction(superAdminId: string): Promise<AdminClientView[]> {
    try {
        const accountsCollection = adminDb.collection('accounts');
        const accountsSnap = await accountsCollection.get();
        
        if (accountsSnap.empty) {
            return [];
        }

        const clientViewPromises = accountsSnap.docs.map(async (accountDoc) => {
            const accountData = toSerializableObject(accountDoc.data());
            const ownerId = accountData.ownerId;
            
            if (!ownerId) return null;

            const ownerSnap = await adminDb.doc(`users/${ownerId}`).get();
            if (!ownerSnap.exists) return null;

            const ownerData = toSerializableObject(ownerSnap.data()) as UserAccount;
            
            // Exclude the Super Admin's own account from the client list
            if (ownerData.role === 'superadmin') return null;

            // Fetch all members
            const memberIds = accountData.members || [];
            let members: UserAccount[] = [];
            if (memberIds.length > 0) {
                const memberPromises = memberIds.map((id: string) => adminDb.doc(`users/${id}`).get());
                const memberDocs = await Promise.all(memberPromises);
                members = memberDocs
                    .filter(doc => doc.exists)
                    .map(doc => docToSerializable(doc) as UserAccount);
            }

            return {
                accountId: accountDoc.id,
                ownerId: ownerId,
                ownerName: ownerData.name,
                ownerEmail: ownerData.email,
                ownerStatus: ownerData.status ?? 'ativo',
                hasSeenWelcome: ownerData.hasSeenWelcome ?? false,
                createdAt: typeof ownerData.createdAt === 'string' ? ownerData.createdAt : (ownerData.createdAt as any)?.toDate?.().toISOString() || new Date().toISOString(),
                firstAccessAt: ownerData.firstAccessAt,
                members: members,
            } as AdminClientView;
        });

        const results = await Promise.all(clientViewPromises);
        const validResults = results.filter((r): r is AdminClientView => r !== null);
        
        return validResults.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
        });

    } catch (error) {
        console.error("Error fetching all client accounts:", error);
        return [];
    }
}

export async function getPopulatedRentalById(accountId: string, rentalId: string): Promise<PopulatedRental | null> {
    try {
        const rentalRef = adminDb.doc(`accounts/${accountId}/rentals/${rentalId}`);
        const rentalDoc = await rentalRef.get();

        if (!rentalDoc.exists) {
            return null;
        }

        const rentalData = docToSerializable(rentalDoc) as Rental;
        const anyRentalData = rentalData as any;
        const dumpsterId = anyRentalData.dumpsterId; // Legacy support
        const dumpsterIds = rentalData.dumpsterIds || (dumpsterId ? [dumpsterId] : []);

        // Fetch related documents
        const clientPromise = adminDb.doc(`accounts/${accountId}/clients/${rentalData.clientId}`).get();
        const assignedToPromise = adminDb.doc(`users/${rentalData.assignedTo}`).get();
        const truckPromise = rentalData.truckId ? adminDb.doc(`accounts/${accountId}/trucks/${rentalData.truckId}`).get() : Promise.resolve(null);
        
        const dumpsterPromises = dumpsterIds.map(id => adminDb.doc(`accounts/${accountId}/dumpsters/${id}`).get());

        const [clientSnap, assignedToSnap, truckSnap, ...dumpsterSnaps] = await Promise.all([clientPromise, assignedToPromise, truckPromise, ...dumpsterPromises]);

        const dumpsters = dumpsterSnaps.map(snap => docToSerializable(snap)).filter(d => d !== null) as Dumpster[];

        const populatedRental = {
            ...(rentalData as any),
            itemType: 'rental' as const,
            client: docToSerializable(clientSnap) as Client | null,
            dumpsters: dumpsters,
            assignedToUser: docToSerializable(assignedToSnap) as UserAccount | null,
            truck: docToSerializable(truckSnap) as Truck | null,
        };

        return populatedRental;
    } catch (error) {
        console.error(`Error fetching populated rental by ID ${rentalId}:`, error);
        return null;
    }
}


export async function getPopulatedOperationById(accountId: string, operationId: string): Promise<PopulatedOperation | null> {
  try {
    let operationDoc = await adminDb.doc(`accounts/${accountId}/operations/${operationId}`).get();

    // Fallback: if not in active operations, try completed_operations
    if (!operationDoc.exists) {
        const completedOpDoc = await adminDb.doc(`accounts/${accountId}/completed_operations/${operationId}`).get();
        if (completedOpDoc.exists) {
            operationDoc = completedOpDoc;
        } else {
            return null; // Not found in either collection
        }
    }

    const opData = docToSerializable(operationDoc) as Operation;

    const [clientSnap, truckSnap, driverSnap, accountSnap] = await Promise.all([
        opData.clientId ? adminDb.doc(`accounts/${accountId}/clients/${opData.clientId}`).get() : Promise.resolve(null),
        opData.truckId ? adminDb.doc(`accounts/${accountId}/trucks/${opData.truckId}`).get() : Promise.resolve(null),
        opData.driverId ? adminDb.doc(`users/${opData.driverId}`).get() : Promise.resolve(null),
        adminDb.doc(`accounts/${accountId}`).get(),
    ]);

    const operationTypes = accountSnap.exists ? (accountSnap.data()?.operationTypes as OperationType[] || []) : [];
    const opTypeMap = new Map(operationTypes.map(t => [t.id, t.name]));
    
    const populatedTypes = (opData.typeIds || []).map(id => ({
        id,
        name: opTypeMap.get(id) || 'Tipo desconhecido'
    }));

    return toSerializableObject({
        ...opData,
        itemType: 'operation',
        accountId: accountId,
        operationTypes: populatedTypes,
        client: docToSerializable(clientSnap),
        truck: docToSerializable(truckSnap),
        driver: docToSerializable(driverSnap),
    }) as any as PopulatedOperation;

  } catch (error) {
    console.error(`Error fetching populated operation by ID ${operationId}:`, error);
    return null;
  }
}


export async function getDirectionsAction(
  origin: Omit<Location, 'address'>,
  destination: Omit<Location, 'address'>
): Promise<{
  distanceMeters: number;
  durationSeconds: number;
  distance: string;
  duration: string;
} | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error("Google Maps API key is not configured.");
    return null;
  }

  const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';
  const body = {
    origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
    destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_AWARE',
    languageCode: 'pt-BR'
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.localizedValues',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!data.routes || data.routes.length === 0) {
      console.error('Routes API error:', data.error?.message || 'No route found');
      return null;
    }

    const route = data.routes[0];
    
    const durationSeconds = parseInt(route.duration.slice(0, -1), 10);

    return {
      distanceMeters: route.distanceMeters,
      durationSeconds: durationSeconds,
      distance: route.localizedValues.distance.text,
      duration: route.localizedValues.duration.text
    };
  } catch (error) {
    console.error('Failed to fetch directions from Routes API:', error);
    return null;
  }
}


export async function getSuperAdminsAction(): Promise<UserAccount[]> {
    try {
        const usersRef = adminDb.collection('users');
        const q = usersRef.where('role', '==', 'superadmin');
        const querySnapshot = await q.get();
        
        if (querySnapshot.empty) {
            return [];
        }

        const superAdmins = querySnapshot.docs.map(doc => docToSerializable(doc) as UserAccount);
        return superAdmins;

    } catch (error) {
        console.error("Error fetching super admins:", error);
        return [];
    }
}


export async function geocodeAddress(address: string, accountId?: string): Promise<Location | null> {
    let provider = 'google'; // Default to Google if no account context or legacy behavior
    let apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    let locationIqToken = process.env.NEXT_PUBLIC_LOCATIONIQ_TOKEN || 'pk.7b731f867a11326a628704e56212defb';
    let geoapifyApiKey: string | undefined = undefined;

    if (accountId) {
        try {
            const accountSnap = await adminDb.doc(`accounts/${accountId}`).get();
            if (accountSnap.exists) {
                const accountData = accountSnap.data() as Account;
                provider = accountData.geocodingProvider || 'locationiq'; // Default to locationiq if set in account but provider is missing

                // Override keys if present in account
                if (accountData.googleMapsApiKey) apiKey = accountData.googleMapsApiKey;
                if (accountData.locationIqToken) locationIqToken = accountData.locationIqToken;
                if (accountData.geoapifyApiKey) geoapifyApiKey = accountData.geoapifyApiKey;
            }
        } catch (error) {
            console.error("Error fetching account settings for geocoding:", error);
            // Fallback to defaults
        }
    }

    // --- Geoapify Implementation ---
    if (provider === 'geoapify') {
        const apiKeyToUse = geoapifyApiKey || process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY;

        if (!apiKeyToUse) {
            console.error("Geoapify API key is not configured.");
            return null;
        }

        const url = new URL('https://api.geoapify.com/v1/geocode/search');
        url.searchParams.append('text', address);
        url.searchParams.append('apiKey', apiKeyToUse);
        url.searchParams.append('format', 'json');
        url.searchParams.append('limit', '1');

        try {
            const response = await fetch(url.toString());
            const data = await response.json();

            if (!data.results || data.results.length === 0) {
                 // Fallback to Google if Geoapify fails? No, user selected Geoapify.
                 console.warn("Geoapify found no results.");
                 return null;
            }

            const result = data.results[0];
            return {
                lat: result.lat,
                lng: result.lon,
                address: result.formatted
            };
        } catch (error) {
            console.error(`Geoapify geocode error: ${error}`);
            return null;
        }
    }

    // --- LocationIQ Implementation ---
    // Note: LocationIQ implementation logic was not previously here, but it's good to have if we support it as a provider.
    // However, existing code used Google Maps API by default.
    // If provider is 'locationiq', we should probably use LocationIQ API, but for now,
    // let's stick to adding Geoapify and keeping Google as fallback/default if not Geoapify,
    // OR if provider is 'locationiq' we might need to implement it server-side too.
    // The previous implementation was Google-only.
    // The user asked to ADD Geoapify.

    // For now, if provider is 'locationiq', we might want to fallback to Google if logic isn't here,
    // or implement LocationIQ server-side.
    // Since LocationIQ was the default in the schema but server logic was Google-only,
    // it implies server-side geocoding was always Google.
    // Let's implement LocationIQ server-side as well for completeness if requested,
    // but the task specifically asked for Geoapify.
    // I will stick to Google as the default/fallback for non-Geoapify providers
    // UNLESS I should implement LocationIQ too.
    // Given the prompt "Geopify como padrão", I will ensure Geoapify works.
    // I will leave the Google logic as the `else` block.

    // --- Google Maps Implementation (Default/Fallback) ---
    if (!apiKey) {
        console.error("Google Maps API key is not configured.");
        return null;
    }

    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.append('address', address);
    url.searchParams.append('key', apiKey);
    url.searchParams.append('language', 'pt-BR');

  try {
    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
        console.error('Geocode API error:', data.status, data.error_message);
        return null;
    }
    
    const { lat, lng } = data.results[0].geometry.location;
    return {
        lat,
        lng,
        address: data.results[0].formatted_address
    };

  } catch (error) {
    console.error(`Geocode was not successful for the following reason: ${error}`);
    return null;
  }
}


export async function getCityFromAddressAction(address: string): Promise<string | null> {
    if (!address) {
        return null;
    }
    const location = await geocodeAddress(address);
    if (!location) {
        return null;
    }

    // A reverse geocode might be more reliable for component extraction
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
        console.error("Google Maps API key is not configured.");
        return null;
    }
    
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.append('latlng', `${location.lat},${location.lng}`);
    url.searchParams.append('key', apiKey);
    url.searchParams.append('language', 'pt-BR');
    url.searchParams.append('result_type', 'locality|administrative_area_level_2');

    try {
        const response = await fetch(url.toString());
        const data = await response.json();

        if (data.status !== 'OK' || !data.results || data.results.length === 0) {
            console.error('Reverse Geocode API error:', data.status, data.error_message);
            // Fallback to splitting the formatted address
            return address.split(',').slice(-2, -1)[0]?.trim() || null;
        }

        for (const result of data.results) {
             for (const component of result.address_components) {
                // 'locality' is typically the city
                // 'administrative_area_level_2' is often the city in Brazil
                if (component.types.includes('locality') || component.types.includes('administrative_area_level_2')) {
                    return component.long_name;
                }
            }
        }
        
        return null;

    } catch (error) {
        console.error(`Reverse Geocode was not successful for the following reason: ${error}`);
        return null;
    }
}

export async function getNeighborhoodFromAddressAction(address: string): Promise<string | null> {
    if (!address) {
        return null;
    }
    const location = await geocodeAddress(address);
    if (!location) {
        return null;
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
        console.error("Google Maps API key is not configured.");
        return null;
    }
    
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.append('latlng', `${location.lat},${location.lng}`);
    url.searchParams.append('key', apiKey);
    url.searchParams.append('language', 'pt-BR');
    url.searchParams.append('result_type', 'sublocality_level_1|sublocality');

    try {
        const response = await fetch(url.toString());
        const data = await response.json();

        if (data.status !== 'OK' || !data.results || data.results.length === 0) {
            console.error('Reverse Geocode API error for neighborhood:', data.status, data.error_message);
            return null;
        }

        for (const result of data.results) {
             for (const component of result.address_components) {
                if (component.types.includes('sublocality') || component.types.includes('sublocality_level_1')) {
                    return component.long_name;
                }
            }
        }
        
        return null; // Return null if no neighborhood is found

    } catch (error) {
        console.error(`Reverse Geocode for neighborhood was not successful: ${error}`);
        return null;
    }
}


export async function getWeatherForecastAction(
  location: Omit<Location, 'address'>,
  date: Date
): Promise<{ condition: string; tempC: number } | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error('Google Weather API key is not configured.');
    return null;
  }

  // Use the hourly forecast endpoint
  const url = new URL('https://weather.googleapis.com/v1/forecast/hours:lookup');
  url.searchParams.append('key', apiKey);
  url.searchParams.append('location.latitude', String(location.lat));
  url.searchParams.append('location.longitude', String(location.lng));
  url.searchParams.append('languageCode', 'pt-BR');

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
        const errorData = await response.json();
        console.error("Weather API request failed:", response.status, errorData);
        return null;
    }
    const data = await response.json();
    
    if (!data.forecastHours || data.forecastHours.length === 0) {
      console.error('Weather API error: No hourly forecast data returned.', data);
      return null;
    }

    const requestedTime = date.getTime();
    
    // Find the forecast for the hour closest to the requested start time
    const forecastForHour = data.forecastHours.reduce((prev: any, curr: any) => {
        const prevTime = new Date(prev.interval.startTime).getTime();
        const currTime = new Date(curr.interval.startTime).getTime();
        return Math.abs(currTime - requestedTime) < Math.abs(prevTime - requestedTime) ? curr : prev;
    });


    if (forecastForHour && forecastForHour.weatherCondition) {
      const { description } = forecastForHour.weatherCondition;
      const { degrees } = forecastForHour.temperature;

      return {
        condition: description?.text || 'Tempo não disponível',
        tempC: Math.round(degrees),
      };
    }

    return null;
  } catch (error) {
    console.error('Failed to fetch weather forecast:', error);
    return null;
  }
}

// #region Server-Side Data Fetchers for Calendar Sync
export async function getPopulatedRentalsForServer(accountId: string): Promise<PopulatedRental[]> {
  const rentalsSnap = await adminDb.collection(`accounts/${accountId}/rentals`).get();
  if (rentalsSnap.empty) return [];

  const rentalsData = rentalsSnap.docs.map(doc => docToSerializable(doc) as Rental);

  const clientIds = [...new Set(rentalsData.map(r => r.clientId))];
  const dumpsterIds = [...new Set(rentalsData.flatMap(r => r.dumpsterIds || ((r as any).dumpsterId ? [(r as any).dumpsterId] : [])))];
  const userIds = [...new Set(rentalsData.map(r => r.assignedTo))];

  const [clientsSnap, dumpstersSnap, usersSnap] = await Promise.all([
    clientIds.length ? adminDb.collection(`accounts/${accountId}/clients`).where(FieldPath.documentId(), 'in', clientIds).get() : Promise.resolve({ docs: [] }),
    dumpsterIds.length ? adminDb.collection(`accounts/${accountId}/dumpsters`).where(FieldPath.documentId(), 'in', dumpsterIds).get() : Promise.resolve({ docs: [] }),
    userIds.length ? adminDb.collection('users').where(FieldPath.documentId(), 'in', userIds).get() : Promise.resolve({ docs: [] }),
  ]);

  const clientsMap = new Map(clientsSnap.docs.map(d => [d.id, docToSerializable(d)]));
  const dumpstersMap = new Map(dumpstersSnap.docs.map(d => [d.id, docToSerializable(d)]));
  const usersMap = new Map(usersSnap.docs.map(d => [d.id, docToSerializable(d)]));

  return rentalsData.map(rental => {
      const dumpsterIdsForRental = rental.dumpsterIds || ((rental as any).dumpsterId ? [(rental as any).dumpsterId] : []);
      return {
        ...rental,
        itemType: 'rental',
        client: clientsMap.get(rental.clientId) || null,
        dumpsters: dumpsterIdsForRental.map(id => dumpstersMap.get(id)).filter(Boolean) as Dumpster[],
        assignedToUser: usersMap.get(rental.assignedTo) || null,
      } as PopulatedRental;
  });
}

export async function getPopulatedOperationsForServer(accountId: string): Promise<PopulatedOperation[]> {
    const accountSnap = await adminDb.doc(`accounts/${accountId}`).get();
    if (!accountSnap.exists) return [];
    
    const operationTypes = accountSnap.data()?.operationTypes as OperationType[] || [];
    const opTypeMap = new Map(operationTypes.map(t => [t.id, t.name]));
    
    const opsSnap = await adminDb.collection(`accounts/${accountId}/operations`).get();
    if (opsSnap.empty) return [];

    const opsData = opsSnap.docs.map(doc => docToSerializable(doc) as Operation);

    const clientIds = [...new Set(opsData.map(o => o.clientId))];
    const truckIds = [...new Set(opsData.map(o => o.truckId).filter(Boolean))];
    const driverIds = [...new Set(opsData.map(o => o.driverId))];

    const [clientsSnap, trucksSnap, driversSnap] = await Promise.all([
        clientIds.length ? adminDb.collection(`accounts/${accountId}/clients`).where(FieldPath.documentId(), 'in', clientIds).get() : Promise.resolve({ docs: [] }),
        truckIds.length ? adminDb.collection(`accounts/${accountId}/trucks`).where(FieldPath.documentId(), 'in', truckIds).get() : Promise.resolve({ docs: [] }),
        driverIds.length ? adminDb.collection('users').where(FieldPath.documentId(), 'in', driverIds).get() : Promise.resolve({ docs: [] }),
    ]);

    const clientsMap = new Map(clientsSnap.docs.map(d => [d.id, docToSerializable(d)]));
    const trucksMap = new Map(trucksSnap.docs.map(d => [d.id, docToSerializable(d)]));
    const driversMap = new Map(driversSnap.docs.map(d => [d.id, docToSerializable(d)]));
    
    return opsData.map(op => ({
        ...op,
        itemType: 'operation',
        operationTypes: (op.typeIds || []).map(id => ({ id, name: opTypeMap.get(id) || 'Tipo desconhecido' })),
        client: clientsMap.get(op.clientId) || null,
        truck: op.truckId ? trucksMap.get(op.truckId) || null : null,
        driver: driversMap.get(op.driverId) || null,
    }));
}


export async function getRecurrenceProfilesWithDetails(accountId: string) {
    if (!accountId) return [];

    try {
        const profilesSnap = await adminDb.collection(`accounts/${accountId}/recurrence_profiles`).get();
        if (profilesSnap.empty) return [];

        const profilesData = profilesSnap.docs.map(doc => docToSerializable(doc));

        const populatedProfiles = await Promise.all(
            profilesData.map(async (profile) => {
                let details = null;
                if (profile.originalOrderId) {
                    if (profile.type === 'operation') {
                        details = await getPopulatedOperationById(accountId, profile.originalOrderId);
                    } else {
                        // Assuming 'rental' is the other type
                        details = await getPopulatedRentalById(accountId, profile.originalOrderId);
                    }
                }

                // Fallback: Populate client in templateData if missing in details
                if ((!details || !details.client) && profile.templateData?.clientId) {
                    // Check if client is already populated in templateData (avoid re-fetching if possible, though unlikely here)
                    if (!profile.templateData.client?.name) {
                        try {
                            const clientSnap = await adminDb.doc(`accounts/${accountId}/clients/${profile.templateData.clientId}`).get();
                            if (clientSnap.exists) {
                                profile.templateData.client = docToSerializable(clientSnap);
                            }
                        } catch (err) {
                            console.error(`Error fetching fallback client for profile ${profile.id}:`, err);
                        }
                    }
                }

                return { ...profile, details };
            })
        );

        return populatedProfiles;

    } catch (error) {
        console.error("Error fetching recurrence profiles with details:", error);
        return [];
    }
}

export async function getRecurrenceProfileById(accountId: string, profileId: string) {
    if (!accountId || !profileId) return null;
    try {
        const profileSnap = await adminDb.doc(`accounts/${accountId}/recurrence_profiles/${profileId}`).get();
        if (!profileSnap.exists) return null;
        return docToSerializable(profileSnap);
    } catch (error) {
        console.error("Error fetching recurrence profile by ID:", error);
        return null;
    }
}
// #endregion

export async function fetchTrucksAction(accountId: string): Promise<Truck[]> {
    if (!accountId) return [];
    try {
        const trucksCol = adminDb.collection(`accounts/${accountId}/trucks`);
        const snapshot = await trucksCol.get();
        if (snapshot.empty) return [];
        return snapshot.docs.map(doc => toSerializableObject({ id: doc.id, ...doc.data() }) as Truck).sort((a, b) => a.name.localeCompare(b.name));
    } catch (e) {
        console.error("Error fetching trucks server action:", e);
        return [];
    }
}
