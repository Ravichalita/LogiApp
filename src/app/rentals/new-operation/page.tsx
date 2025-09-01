
'use client';

import { useEffect, useState, useMemo } from 'react';
import { fetchClients, fetchTrucks, fetchTeamMembers, getAccount } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { OperationForm } from './operation-form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Truck as TruckIcon } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { Skeleton } from '@/components/ui/skeleton';
import type { Client, Truck, UserAccount, Account, Service } from '@/lib/types';

export default function NewOperationPage() {
  const { accountId } = useAuth();
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [team, setTeam] = useState<UserAccount[]>([]);
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (accountId) {
      const fetchData = async () => {
        setLoading(true);
        
        const [userClients, teamMembers, fetchedTrucks] = await Promise.all([
            fetchClients(accountId),
            fetchTeamMembers(accountId),
            fetchTrucks(accountId),
        ]);
        
        setClients(userClients);
        setTeam(teamMembers);
        setTrucks(fetchedTrucks);
        
        const unsubAccount = getAccount(accountId, (acc) => {
            setAccount(acc);
            setLoading(false); // Considered loaded when account info is present
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
                {trucks.length === 0 && <p>Não há caminhões cadastrados. <Link href="/trucks" className="font-bold underline">Cadastre um caminhão</Link>.</p>}
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
