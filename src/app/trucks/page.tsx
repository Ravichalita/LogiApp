
'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { TruckCard, type Truck } from './truck-card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { NewItemDialog } from '@/components/new-item-dialog';
import { useAuth } from '@/context/auth-context';
import { getDumpsters } from '@/lib/data';
import type { Dumpster } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

// Helper to filter and map dumpsters to the Truck type for this page
const mapDumpsterToTruck = (dumpster: Dumpster): Truck => ({
    id: dumpster.id,
    model: dumpster.name, // Use name as model
    licensePlate: dumpster.color, // Repurpose color for license plate for now
    year: dumpster.size, // Repurpose size for year
    type: 'Caminhão', // Generic type
    capacity: '' // Capacity not stored in dumpster model
});


export default function TrucksPage() {
  const { accountId } = useAuth();
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (accountId) {
      // For now, we'll represent trucks as a type of dumpster
      // A dedicated 'trucks' collection would be a future improvement
      const unsubscribe = getDumpsters(accountId, (allDumpsters) => {
         // This is a placeholder logic. We assume dumpsters with certain names are trucks.
         // A better approach would be a 'type' field in the dumpster document.
        const filteredTrucks = allDumpsters
          .filter(d => d.name.toLowerCase().includes('caminhão') || d.name.toLowerCase().includes('scania') || d.name.toLowerCase().includes('volvo'))
          .map(mapDumpsterToTruck);
        
        setTrucks(filteredTrucks);
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [accountId]);


  if (loading) {
    return (
        <div className="p-4">
             <h1 className="text-2xl font-bold mb-4">Frota de Caminhões</h1>
             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
             </div>
        </div>
    )
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Frota de Caminhões</h1>
       <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {trucks.map(truck => (
          <TruckCard
            key={truck.id}
            truck={truck}
          />
        ))}
         {trucks.length === 0 && (
            <div className="col-span-full text-center py-16 bg-card rounded-lg border">
                <p className="text-muted-foreground">Nenhum caminhão cadastrado.</p>
                <p className="text-xs text-muted-foreground mt-2">Dica: Cadastre um item em "Caçambas" com a palavra "Caminhão" no nome.</p>
            </div>
         )}
      </div>

       <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50">
           <NewItemDialog itemType="dumpster" />
       </div>
    </div>
  );
}
