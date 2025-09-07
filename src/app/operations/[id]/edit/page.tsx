
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import type { PopulatedOperation, Client, UserAccount, Truck, Account, OperationType } from '@/lib/types';
import { getPopulatedOperationById } from '@/lib/data-server-actions';
import { fetchClients, fetchTeamMembers, getTrucks, getAccount, getPopulatedOperations } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { EditOperationForm } from './edit-operation-form';

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
        const [opData, clientData, teamData, accountData] = await Promise.all([
          getPopulatedOperationById(accountIdForData, operationId),
          fetchClients(accountIdForData),
          fetchTeamMembers(accountIdForData),
          new Promise<Account | null>((resolve) => {
            const unsub = getAccount(accountIdForData, (acc) => {
                resolve(acc);
            });
          })
        ]);

        if (!opData) {
          throw new Error('Operação não encontrada.');
        }
        
        const unsubTrucks = getTrucks(accountIdForData, setTrucks);
        const unsubOps = getPopulatedOperations(accountIdForData, setOperations, console.error);
        
        setOperation(opData);
        setClients(clientData);
        setTeam(teamData);
        setAccount(accountData);
        setOperationTypes(accountData?.operationTypes || []);

        return () => {
          unsubTrucks();
          unsubOps();
        };

      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : 'Falha ao carregar os dados da operação.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();

  }, [accountIdForData, operationId]);

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
