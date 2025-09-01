
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { getTrucks } from '@/lib/data';
import type { Truck } from '@/lib/types';
import { TruckCard } from './truck-card';
import { NewItemDialog } from '@/components/new-item-dialog';
import { Skeleton } from '@/components/ui/skeleton';

export default function TrucksPage() {
  const { accountId } = useAuth();
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (accountId) {
      setLoading(true);
      const unsubscribe = getTrucks(accountId, (fetchedTrucks) => {
        setTrucks(fetchedTrucks);
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      setLoading(false);
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
            </div>
         )}
      </div>

       <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50">
           <NewItemDialog itemType="truck" />
       </div>
    </div>
  );
}
