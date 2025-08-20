
'use client';

import { useEffect, useState } from 'react';
import { fetchClients, fetchDumpsters } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RentalForm } from './rental-form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Truck } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { Skeleton } from '@/components/ui/skeleton';
import type { Client, Dumpster } from '@/lib/types';


export default function NewRentalPage() {
  const { user } = useAuth();
  const [dumpsters, setDumpsters] = useState<Dumpster[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      const fetchData = async () => {
        setLoading(true);
        const [userDumpsters, userClients] = await Promise.all([
          fetchDumpsters(user.uid),
          fetchClients(user.uid),
        ]);
        setDumpsters(userDumpsters);
        setClients(userClients);
        setLoading(false);
      };
      fetchData();
    } else {
        setLoading(false);
        setDumpsters([]);
        setClients([]);
    }
  }, [user]);


  const availableDumpsters = dumpsters.filter(d => d.status === 'Disponível');

  return (
    <div className="container mx-auto max-w-2xl py-8">
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
                {availableDumpsters.length === 0 && <p>Não há caçambas disponíveis. <Link href="/dumpsters" className="font-bold underline">Cadastre uma nova caçamba</Link>.</p>}
                {clients.length === 0 && <p>Não há clientes cadastrados. <Link href="/clients" className="font-bold underline">Cadastre um novo cliente</Link>.</p>}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
