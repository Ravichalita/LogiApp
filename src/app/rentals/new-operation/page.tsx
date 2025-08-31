

'use client';

import { useEffect, useState, useMemo } from 'react';
import { fetchClients, getDumpsters, getRentals, fetchTeamMembers, getAccount } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { OperationForm } from './operation-form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Truck as TruckIcon } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { Skeleton } from '@/components/ui/skeleton';
import type { Client, Dumpster, Rental, UserAccount, Account, Service } from '@/lib/types';

export default function NewOperationPage() {
  const { accountId } = useAuth();
  const [trucks, setTrucks] = useState<any[]>([]); // To be replaced with actual truck fetching logic
  const [clients, setClients] = useState<Client[]>([]);
  const [team, setTeam] = useState<UserAccount[]>([]);
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  // Mock truck data for now
  const initialTrucks: any[] = [
    {
      id: '1',
      model: 'Scania R450',
      licensePlate: 'BRA2E19',
      year: 2023,
      capacity: '25 toneladas',
    },
    {
      id: '2',
      model: 'Volvo FH 540',
      licensePlate: 'PRL1A23',
      year: 2022,
      capacity: '27 toneladas',
    },
  ];

  useEffect(() => {
    if (accountId) {
      const fetchData = async () => {
        setLoading(true);
        const userClients = await fetchClients(accountId);
        setClients(userClients);

        const teamMembers = await fetchTeamMembers(accountId);
        setTeam(teamMembers);
        
        // TODO: Replace mock data with actual truck fetching logic
        setTrucks(initialTrucks);
        
        const unsubAccount = getAccount(accountId, (acc) => {
            setAccount(acc);
            setLoading(false);
        });
        
        return () => {
          unsubAccount();
        }
      };
      fetchData();
    } else {
        setLoading(false);
        setClients([]);
        setTeam([]);
        setAccount(null);
        setTrucks([]);
    }
  }, [accountId]);


  return (
    <div className="container mx-auto max-w-2xl py-8 px-4 md:px-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-2xl">Nova Operação</CardTitle>
          <CardDescription>Selecione o caminhão, o cliente e os detalhes para registrar uma nova operação.</CardDescription>
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
          ) : (trucks.length > 0 && clients.length > 0 && account) ? (
             <OperationForm 
                trucks={trucks} 
                clients={clients} 
                team={team} 
                services={account.services || []}
                account={account}
             />
          ) : (
            <Alert>
              <TruckIcon className="h-4 w-4" />
              <AlertTitle>Faltam informações para criar uma Operação!</AlertTitle>
              <AlertDescription>
                {trucks.length === 0 && <p>Não há caminhões cadastrados. <Link href="/trucks" className="font-bold underline">Gerencie sua frota</Link>.</p>}
                {clients.length === 0 && <p>Não há clientes cadastrados. <Link href="/clients" className="font-bold underline">Cadastre um novo cliente</Link>.</p>}
                 {!account && <p>As configurações da conta não foram carregadas.</p>}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
