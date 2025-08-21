
'use client';

import { useEffect, useState, useMemo } from 'react';
import { fetchClients, getDumpsters, getRentals } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RentalForm, type DumpsterForForm } from './rental-form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Truck } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { Skeleton } from '@/components/ui/skeleton';
import type { Client, Dumpster, Rental } from '@/lib/types';
import { isAfter, isWithinInterval, startOfToday, format } from 'date-fns';

export default function NewRentalPage() {
  const { user } = useAuth();
  const [dumpsters, setDumpsters] = useState<Dumpster[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [allRentals, setAllRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      const fetchData = async () => {
        setLoading(true);
        const userClients = await fetchClients(user.uid);
        setClients(userClients);

        const unsubDumpsters = getDumpsters(user.uid, setDumpsters);
        const unsubRentals = getRentals(user.uid, setAllRentals);
        
        setLoading(false);

        return () => {
          unsubDumpsters();
          unsubRentals();
        }
      };
      fetchData();
    } else {
        setLoading(false);
        setDumpsters([]);
        setClients([]);
        setAllRentals([]);
    }
  }, [user]);


  const dumpstersForForm = useMemo((): DumpsterForForm[] => {
    const today = startOfToday();

    return dumpsters
      .filter(d => {
        // Exclude dumpsters in maintenance
        if (d.status === 'Em Manutenção') {
          return false;
        }

        // Exclude dumpsters currently rented or overdue
        const activeOrOverdueRental = allRentals.find(r => 
          r.dumpsterId === d.id && 
          (isWithinInterval(today, { start: new Date(r.rentalDate), end: new Date(r.returnDate) }) || isAfter(today, new Date(r.returnDate)))
        );

        return !activeOrOverdueRental;
      })
      .map(d => {
        // Find the next reservation if it exists
        const futureRental = allRentals
          .filter(r => r.dumpsterId === d.id && isAfter(new Date(r.rentalDate), today))
          .sort((a, b) => new Date(a.rentalDate).getTime() - new Date(b.rentalDate).getTime())[0];
        
        if (futureRental) {
          return {
            ...d,
            availableUntil: new Date(futureRental.rentalDate),
          };
        }
        
        return { ...d, availableUntil: undefined };
      });
  }, [dumpsters, allRentals]);

  return (
    <div className="container mx-auto max-w-2xl py-8 px-4 md:px-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-2xl">Lançar Novo Aluguel</CardTitle>
          <CardDescription>Selecione a caçamba, o cliente e as datas para registrar um novo aluguel.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-6">
              <div className="space-y-2">
                 <Skeleton className="h-4 w-20" />
                 <Skeleton className="h-10 w-full" />
              </div>
               <div className="space-y-2">
                 <Skeleton className="h-4 w-20" />
                 <Skeleton className="h-10 w-full" />
              </div>
               <div className="space-y-2">
                 <Skeleton className="h-4 w-20" />
                 <Skeleton className="h-10 w-full" />
              </div>
            </div>
          ) : (dumpstersForForm.length > 0 && clients.length > 0) ? (
             <RentalForm dumpsters={dumpstersForForm} clients={clients} />
          ) : (
            <Alert>
              <Truck className="h-4 w-4" />
              <AlertTitle>Faltam informações para criar um aluguel!</AlertTitle>
              <AlertDescription>
                {dumpstersForForm.length === 0 && <p>Não há caçambas disponíveis. <Link href="/dumpsters" className="font-bold underline">Gerencie suas caçambas</Link>.</p>}
                {clients.length === 0 && <p>Não há clientes cadastrados. <Link href="/clients" className="font-bold underline">Cadastre um novo cliente</Link>.</p>}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
