

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { OperationForm } from './operation-form';
import { useAuth } from '@/context/auth-context';
import type { Client, UserAccount, Truck, Account, OperationType } from '@/lib/types';
import { fetchClients, fetchTeamMembers, getTrucks, getAccount } from '@/lib/data';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Link } from 'lucide-react';

export default function NewOperationPage() {
  const { accountId } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [team, setTeam] = useState<UserAccount[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [account, setAccount] = useState<Account | null>(null);
  const [operationTypes, setOperationTypes] = useState<OperationType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (accountId) {
      const fetchData = async () => {
        setLoading(true);
        const [clientData, teamData, accountData] = await Promise.all([
          fetchClients(accountId),
          fetchTeamMembers(accountId),
          new Promise<Account | null>((resolve) => {
            const unsub = getAccount(accountId, (acc) => {
                unsub();
                resolve(acc);
            });
          })
        ]);
        setClients(clientData);
        setTeam(teamData);
        setAccount(accountData);
        setOperationTypes(accountData?.operationTypes || []);
        
        const unsubTrucks = getTrucks(accountId, (truckData) => {
          setTrucks(truckData);
          setLoading(false);
        });

        return () => unsubTrucks();
      };
      fetchData();
    } else {
      setLoading(false);
    }
  }, [accountId]);


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
                team={team} 
                trucks={trucks} 
                operationTypes={operationTypes}
                account={account}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
