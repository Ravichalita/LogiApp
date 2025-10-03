
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import type { PopulatedOperation, Client, UserAccount, Truck, Account, OperationType, Rental, CompletedRental, CompletedOperation } from '@/lib/types';
import { getPopulatedOperationById } from '@/lib/data-server-actions';
import { fetchClients, fetchTeamMembers, getTrucks, getAccount, getPopulatedOperations, getRentals } from '@/lib/data';
import { getCompletedRentals, getCompletedOperations } from '@/lib/data-server-actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { EditOperationForm } from './edit-operation-form';
import { differenceInDays, parseISO } from 'date-fns';


function EditOperationPageSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </CardHeader>
      <CardContent className="space-y-6">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function EditOperationPage() {
  const auth = useAuth();
  const params = useParams();

  const operationId = params.id as string;
  const accountIdForData = auth.accountId;

  const [operation, setOperation] = useState<PopulatedOperation | null>(null);
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accountIdForData || !operationId) {
      setError('ID da conta ou da operação não encontrado.');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [
            opData, 
            clientData, 
            teamData, 
            accountData, 
            completedRentalsData, 
            completedOpsData
        ] = await Promise.all([
          getPopulatedOperationById(accountIdForData, operationId),
          fetchClients(accountIdForData),
          fetchTeamMembers(accountIdForData),
          new Promise<Account | null>((resolve) => {
            const unsub = getAccount(accountIdForData, (acc) => {
                unsub();
                resolve(acc);
            });
          }),
          getCompletedRentals(accountIdForData),
          getCompletedOperations(accountIdForData)
        ]);

        if (!opData) {
          throw new Error('Operação não encontrada.');
        }
        
        const unsubTrucks = getTrucks(accountIdForData, setTrucks);
        const unsubOps = getPopulatedOperations(accountIdForData, setOperations, console.error);
        const unsubRentals = getRentals(accountIdForData, setRentals);
        
        setOperation(opData);
        setClients(clientData);
        setTeam(teamData);
        setAccount(accountData);
        setOperationTypes(accountData?.operationTypes || []);
        setCompletedRentals(completedRentalsData);
        setCompletedOperations(completedOpsData);

        setLoading(false);

        return () => {
          unsubTrucks();
          unsubOps();
          unsubRentals();
        };

      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : 'Falha ao carregar os dados da operação.');
        setLoading(false);
      }
    };

    fetchData();

  }, [accountIdForData, operationId]);
  
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


  if (loading) {
    return (
      <div className="container mx-auto max-w-2xl py-8 px-4 md:px-6">
        <EditOperationPageSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-2xl py-8 px-4 md:px-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl py-8 px-4 md:px-6 bg-muted/30">
      <Card className="border-0 shadow-none bg-transparent">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">Editar Operação #OP{operation?.sequentialId}</CardTitle>
          <CardDescription>Ajuste as informações da operação e salve as alterações.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {operation && (
            <EditOperationForm
              operation={operation}
              clients={clients}
              classifiedClients={classifiedClients}
              team={team}
              trucks={trucks}
              operations={operations}
              operationTypes={operationTypes}
              account={account}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
