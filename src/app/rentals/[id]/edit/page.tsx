
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import type { PopulatedRental, Client, Dumpster, UserAccount, Account, Service, Truck } from '@/lib/types';
import { getDoc, doc } from 'firebase/firestore';
import { getFirebase, fetchClients, getAccount, getDumpsters, fetchTeamMembers, fetchTrucks } from '@/lib/data';
import { EditRentalForm } from './edit-rental-form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { getPopulatedRentalById } from '@/lib/data-server-actions';
import { useParams } from 'next/navigation';


export default function EditRentalPage() {
  const params = useParams();
  const rentalId = params.id as string;
  const { accountId } = useAuth();
  const [rental, setRental] = useState<PopulatedRental | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [team, setTeam] = useState<UserAccount[]>([]);
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dumpsters, setDumpsters] = useState<Dumpster[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);

  useEffect(() => {
    if (!accountId || !rentalId) {
        if (!accountId) setError("A conta não foi identificada.");
        if (!rentalId) setError("A OS não foi identificada.");
        setLoading(false);
        return;
    };

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const rentalData = await getPopulatedRentalById(accountId, rentalId);
            if (!rentalData) {
                setError('Ordem de Serviço não encontrada.');
                setLoading(false);
                return;
            }
            setRental(rentalData);

            const [clientData, teamData, accountData, allDumpsters, allTrucks] = await Promise.all([
                fetchClients(accountId),
                fetchTeamMembers(accountId),
                new Promise<Account | null>((resolve) => {
                    const unsub = getAccount(accountId, (acc) => {
                        unsub();
                        resolve(acc);
                    });
                }),
                new Promise<Dumpster[]>((resolve) => {
                    const unsub = getDumpsters(accountId, (dumpsters) => {
                        unsub();
                        resolve(dumpsters);
                    });
                }),
                fetchTrucks(accountId),
            ]);
            
            setClients(clientData);
            setTeam(teamData);
            setAccount(accountData);
            setDumpsters(allDumpsters);
            setTrucks(allTrucks);

        } catch (e) {
            console.error(e);
            setError('Falha ao carregar os dados para edição.');
        } finally {
            setLoading(false);
        }
    };

    fetchData();

  }, [accountId, rentalId]);


  if (loading) {
    return (
        <div className="container mx-auto max-w-2xl py-8 px-4 md:px-6">
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent className="space-y-6">
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
                </CardContent>
            </Card>
        </div>
    )
  }

  if (error) {
      return (
          <div className="container mx-auto max-w-2xl py-8 px-4 md:px-6">
               <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Erro</AlertTitle>
                    <AlertDescription>
                       {error}
                    </AlertDescription>
                </Alert>
          </div>
      )
  }

  return (
    <div className="container mx-auto max-w-2xl py-8 px-4 md:px-6">
        <Card>
            <CardHeader>
                <CardTitle className="font-headline text-2xl">Editar Ordem de Serviço #{rental?.sequentialId}</CardTitle>
                <CardDescription>Ajuste as informações da OS e salve as alterações.</CardDescription>
            </CardHeader>
            <CardContent>
                {rental && account && (
                    <EditRentalForm
                        rental={rental}
                        clients={clients}
                        team={team}
                        rentalPrices={account.rentalPrices}
                        dumpsters={dumpsters}
                        trucks={trucks}
                        services={account.services}
                    />
                )}
            </CardContent>
        </Card>
    </div>
  )
}
