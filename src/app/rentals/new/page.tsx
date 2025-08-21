
'use client';

import { useEffect, useState, useMemo } from 'react';
import { fetchClients, getDumpsters, getRentals } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RentalForm } from './rental-form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Truck } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { Skeleton } from '@/components/ui/skeleton';
import type { Client, Dumpster, Rental } from '@/lib/types';
import { isAfter, isWithinInterval, startOfToday } from 'date-fns';


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
        const [userClients] = await Promise.all([
          fetchClients(user.uid),
        ]);
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


  const availableDumpsters = useMemo(() => {
    const today = startOfToday();

    const unavailableDumpsterIds = new Set<string>();

    // Mark dumpsters in maintenance as unavailable
    dumpsters.forEach(d => {
        if(d.status === 'Em Manutenção') {
            unavailableDumpsterIds.add(d.id);
        }
    });

    // Mark dumpsters that have an active, future, or overdue rental as unavailable
    allRentals.forEach(r => {
        const rentalStart = new Date(r.rentalDate);
        const rentalEnd = new Date(r.returnDate);
        // A dumpster is unavailable if it's currently rented, overdue, or has a future booking.
        if (isAfter(rentalEnd, today) || isWithinInterval(today, {start: rentalStart, end: rentalEnd}) || isAfter(today, rentalEnd)) {
            unavailableDumpsterIds.add(r.dumpsterId);
        }
    });
    
    return dumpsters.filter(d => !unavailableDumpsterIds.has(d.id));
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
          ) : (availableDumpsters.length > 0 && clients.length > 0) ? (
             <RentalForm dumpsters={availableDumpsters} clients={clients} />
          ) : (
            <Alert>
              <Truck className="h-4 w-4" />
              <AlertTitle>Faltam informações para criar um aluguel!</AlertTitle>
              <AlertDescription>
                {availableDumpsters.length === 0 && <p>Não há caçambas disponíveis. <Link href="/dumpsters" className="font-bold underline">Gerencie suas caçambas</Link>.</p>}
                {clients.length === 0 && <p>Não há clientes cadastrados. <Link href="/clients" className="font-bold underline">Cadastre um novo cliente</Link>.</p>}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
