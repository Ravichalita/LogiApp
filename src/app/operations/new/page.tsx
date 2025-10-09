
'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { OperationForm } from './operation-form';
import { useAuth } from '@/context/auth-context';
import type { Client, UserAccount, Truck, Account, OperationType, PopulatedOperation, PopulatedRental, Rental, CompletedRental, CompletedOperation } from '@/lib/types';
import { fetchClients, fetchTeamMembers, getTrucks, getAccount, getPopulatedOperations, getRentals, fetchAccount } from '@/lib/data';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Link } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';
import { getCompletedRentals, getCompletedOperations } from '@/lib/data-server-actions';

function NewOperationPageContent() {
  const { accountId } = useAuth();
  const searchParams = useSearchParams();
  const prefillClientId = searchParams.get('clientId') || undefined;

  const [clients, setClients] = useState<Client[]>([]);
  const [team, setTeam] = useState<UserAccount[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [operations, setOperations] = useState<PopulatedOperation[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [completedRentals, setCompletedRentals] = useState<CompletedRental[]>([]);
  const [completedOperations, setCompletedOperations] = useState<CompletedOperation[]>([]);
  const [account, setAccount] = useState<Account | null>(null);
  const [operationTypes, setOperationTypes] = useState<OperationType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (accountId) {
      const fetchData = async () => {
        setLoading(true);
        const [clientData, teamData, accountData, completedRentalsData, completedOpsData] = await Promise.all([
          fetchClients(accountId),
          fetchTeamMembers(accountId),
          fetchAccount(accountId),
          getCompletedRentals(accountId),
          getCompletedOperations(accountId),
        ]);
        setClients(clientData);
        setTeam(teamData);
        setAccount(accountData);
        setOperationTypes(accountData?.operationTypes || []);
        setCompletedRentals(completedRentalsData);
        setCompletedOperations(completedOpsData);
        
        const unsubTrucks = getTrucks(accountId, setTrucks);
        const unsubOps = getPopulatedOperations(accountId, setOperations, console.error);
        const unsubRentals = getRentals(accountId, setRentals);

        setLoading(false);

        return () => {
            unsubTrucks();
            unsubOps();
            unsubRentals();
        }
      };
      fetchData();
    } else {
      setLoading(false);
    }
  }, [accountId]);
  
  const classifiedClients = useMemo(() => {
    const today = new Date();

    const activeClientIds = new Set([
        ...rentals.map(r => r.clientId),
        ...operations.map(o => o.clientId)
    ]);
    
    const completedClientIds = new Set([
        ...completedRentals.map(r => r.clientId),
        ...completedOperations.map(o => o.clientId)
    ]);
    
    const newClients: Client[] = [];
    const activeClients: Client[] = [];
    const completedClients: Client[] = [];
    const unservedClients: Client[] = [];

    clients.forEach(client => {
      const hasActiveService = activeClientIds.has(client.id);
      const hasCompletedService = completedClientIds.has(client.id);
      const creationDate = client.createdAt ? (typeof client.createdAt === 'string' ? parseISO(client.createdAt) : client.createdAt.toDate()) : new Date(0);
      const isNew = differenceInDays(today, creationDate) <= 3;

      if (hasActiveService) {
        activeClients.push(client);
      } else if (isNew && !hasActiveService && !hasCompletedService) {
        newClients.push(client);
      } else if (!hasActiveService && hasCompletedService) {
        completedClients.push(client);
      } else if (!isNew && !hasActiveService && !hasCompletedService) {
        unservedClients.push(client);
      }
    });
    
    const sortFn = (a: Client, b: Client) => a.name.localeCompare(b.name);

    return {
      newClients: newClients.sort(sortFn),
      activeClients: activeClients.sort(sortFn),
      completedClients: completedClients.sort(sortFn),
      unservedClients: unservedClients.sort(sortFn),
    };
  }, [clients, rentals, operations, completedRentals, completedOperations]);


  return (
    <div className="container mx-auto max-w-2xl py-8 px-4 md:px-6 bg-muted/30">
      <Card className="border-0 shadow-none bg-transparent">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">Nova Operação</CardTitle>
          <CardDescription>Preencha os detalhes para criar uma nova operação.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
             <div className="space-y-6">
              {[...Array(5)].map((_, i) => (
                 <div key={i} className="space-y-2">
                   <Skeleton className="h-4 w-20" />
                   <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <OperationForm 
                clients={clients}
                classifiedClients={classifiedClients} 
                team={team} 
                trucks={trucks} 
                operations={operations}
                operationTypes={operationTypes}
                account={account}
                prefillClientId={prefillClientId}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function NewOperationPage() {
    return (
        <Suspense fallback={<div>Carregando...</div>}>
            <NewOperationPageContent />
        </Suspense>
    )
}
