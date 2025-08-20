'use client';
import type { Dumpster, Client, Rental, FirestoreEntity, DumpsterStatus, PopulatedRental } from './types';
import { db, auth } from './firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, writeBatch, getDoc, Timestamp, where, onSnapshot } from 'firebase/firestore';

// --- Generic Firestore Functions (CLIENT-SIDE) ---

function getCollection<T extends FirestoreEntity>(userId: string, collectionName: string, callback: (data: T[]) => void) {
  if (!userId) {
    console.log("getCollection called without userId, returning empty array.");
    callback([]);
    return () => {}; // Return an empty unsubscribe function
  }
  const q = query(collection(db, 'users', userId, collectionName));
  
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const data = querySnapshot.docs.map(doc => {
      const docData = doc.data();
      // Convert Firestore Timestamps back to JS Dates
      for (const key in docData) {
        if (docData[key] instanceof Timestamp) {
          docData[key] = docData[key].toDate();
        }
      }
      return { id: doc.id, ...docData } as T;
    });
    callback(data);
  }, (error) => {
    console.error(`Error getting ${collectionName}:`, error);
    callback([]);
  });

  return unsubscribe;
}


async function updateDocument<T extends { id: string }>(userId: string, collectionName: string, data: Partial<T>) {
  if (!userId) throw new Error("Usuário não autenticado.");
  const { id, ...rest } = data;
  if (!id) throw new Error("ID do documento não fornecido para atualização.");
  const docRef = doc(db, 'users', userId, collectionName, id);
  await updateDoc(docRef, rest);
  return data;
}

// --- Data Retrieval Functions ---

export const getDumpsters = (userId: string, callback: (dumpsters: Dumpster[]) => void) => {
  return getCollection<Dumpster>(userId, 'dumpsters', callback);
};

export const getClients = (userId: string, callback: (clients: Client[]) => void) => {
  return getCollection<Client>(userId, 'clients', callback);
};

export const getRentals = (userId: string, callback: (rentals: PopulatedRental[]) => void) => {
  if (!userId) {
    callback([]);
    return () => {};
  }

  const rentalsQuery = query(
    collection(db, 'users', userId, 'rentals'),
    where('status', '==', 'Ativo')
  );

  return onSnapshot(rentalsQuery, async (snapshot) => {
    if (snapshot.empty) {
      callback([]);
      return;
    }

    const rentalsData = snapshot.docs.map(doc => {
       const data = doc.data();
       for (const key in data) {
         if (data[key] instanceof Timestamp) {
           data[key] = data[key].toDate();
         }
       }
       return { id: doc.id, ...data } as Rental;
    });
    
    // Fetch clients and dumpsters
    const clientsQuery = query(collection(db, 'users', userId, 'clients'));
    const dumpstersQuery = query(collection(db, 'users', userId, 'dumpsters'));
    
    const [clientsSnapshot, dumpstersSnapshot] = await Promise.all([
      getDocs(clientsQuery),
      getDocs(dumpstersQuery),
    ]);

    const clients = clientsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Client[];
    const dumpsters = dumpstersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Dumpster[];

    const populatedRentals = rentalsData.map(rental => {
      const client = clients.find(c => c.id === rental.clientId);
      const dumpster = dumpsters.find(d => d.id === rental.dumpsterId);
      if (!client || !dumpster) return null;
      return { ...rental, client, dumpster };
    }).filter(Boolean) as PopulatedRental[];

    callback(populatedRentals.sort((a, b) => new Date(a.returnDate).getTime() - new Date(b.returnDate).getTime()));
  });
};


// --- CLIENT-SIDE Data Mutation Functions ---

export const updateDumpsterStatus = async (userId: string, id: string, status: DumpsterStatus) => {
    return await updateDocument(userId, 'dumpsters', { id, status });
}

export const updateRental = async (userId: string, rental: Partial<Rental>) => {
    if(!rental.id) throw new Error("ID do aluguel não fornecido.");

    const existingRentalRef = doc(db, 'users', userId, 'rentals', rental.id);
    const existingRental = await getDoc(existingRentalRef);
    
    if(!existingRental.exists()) {
       throw new Error('Aluguel não encontrado.');
    }
    const existingRentalData = existingRental.data() as Rental;
    
    const rentalDate = existingRentalData.rentalDate instanceof Timestamp 
        ? existingRentalData.rentalDate.toDate() 
        : new Date(existingRentalData.rentalDate);

    if (rental.returnDate && new Date(rental.returnDate) < rentalDate) {
        throw new Error('A data de devolução não pode ser anterior à data de aluguel.');
    }

    return await updateDocument(userId, 'rentals', rental);
};

// This function performs writes and should probably be a server-side only action,
// but for now we keep it here as it's complex.
export const completeRental = async (userId: string, rentalId: string, dumpsterId: string) => {
  const batch = writeBatch(db);
  
  const rentalRef = doc(db, 'users', userId, 'rentals', rentalId);
  batch.update(rentalRef, { status: 'Concluído' });

  const dumpsterRef = doc(db, 'users', userId, 'dumpsters', dumpsterId);
  batch.update(dumpsterRef, { status: 'Disponível' });

  await batch.commit();
  
  const updatedRentalDoc = await getDoc(rentalRef);
  const updatedRental = updatedRentalDoc.data();
  return { id: rentalId, ...updatedRental } as Rental;
};

// This function is no longer needed on the client, moved to data-server.ts for the dashboard
// export const getRentals = async (userId: string): Promise<Rental[]> => {
//   const q = query(collection(db, 'users', userId, 'rentals'));
//   const querySnapshot = await getDocs(q);
//   return querySnapshot.docs.map(doc => {
//       const data = doc.data();
//       for (const key in data) {
//         if (data[key] instanceof Timestamp) {
//           data[key] = data[key].toDate();
//         }
//       }
//       return { id: doc.id, ...data } as Rental;
//     });
// };
