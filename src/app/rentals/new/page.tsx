
'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { fetchClients, getDumpsters, getRentals, fetchTeamMembers, getAccount, getPopulatedOperations, fetchAccount, getTrucks } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RentalForm, type DumpsterForForm } from './rental-form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Truck } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { Skeleton } from '@/components/ui/skeleton';
import type { Client, Dumpster, Rental, UserAccount, Account, PopulatedOperation, CompletedRental, CompletedOperation } from '@/lib/types';
import { isAfter, isToday, parseISO, startOfToday, format, isWithinInterval, isBefore, endOfDay, subDays, differenceInDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getCompletedRentals, getCompletedOperations } from '@/lib/data-server-actions';

function NewRentalPageContent() {
  const { accountId } = useAuth();
  const searchParams = useSearchParams();
  const prefillDataParam = searchParams.get('prefill');
  const swapOriginId = searchParams.get('swapOriginId');
  
  const prefillData = useMemo(() => {
    if (prefillDataParam) {
      try {
        return JSON.parse(prefillDataParam);
      } catch (e) {
        console.error("Failed to parse prefill data:", e);
        return null;
      }
    }
    return null;
  }, [prefillDataParam]);

  const [dumpsters, setDumpsters] = useState<Dumpster[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [team, setTeam] = useState<UserAccount[]>([]);
  const [allRentals, setAllRentals] = useState<Rental[]>([]);
  const [allOperations, setAllOperations] = useState<PopulatedOperation[]>([]);
  const [allCompletedRentals, setAllCompletedRentals] = useState<CompletedRental[]>([]);
  const [allCompletedOperations, setAllCompletedOperations] = useState<CompletedOperation[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [account, setAccount] = useState<Account | null>(null);
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
          getCompletedOperations(accountId)
        ]);

        setClients(clientData);
        setTeam(teamData);
        setAccount(accountData);
        setAllCompletedRentals(completedRentalsData);
        setAllCompletedOperations(completedOpsData);
        
        const unsubDumpsters = getDumpsters(accountId, setDumpsters);
        const unsubRentals = getRentals(accountId, setAllRentals);
        const unsubOps = getPopulatedOperations(accountId, setAllOperations, console.error);
        const unsubTrucks = getTrucks(accountId, setTrucks);

        setLoading(false);
        
        return () => {
          unsubDumpsters();
          unsubRentals();
          unsubOps();
          unsubTrucks();
        }
      };
      fetchData();
    } else {
        setLoading(false);
    }
  }, [accountId]);


  const dumpstersForForm = useMemo((): DumpsterForForm[] => {
    const today = startOfToday();
  
    const toDate = (v: any): Date | null => {
      if (!v) return null;
      if (typeof v === 'string') return parseISO(v);
      if (v?.toDate) return v.toDate();
      if (v instanceof Date) return v;
      return new Date(v);
    };
  
    return dumpsters.map(d => {
      if (d.status === 'Em Manutenção') {
        return { ...d, specialStatus: "Em Manutenção", disabled: true, disabledRanges: [], schedules: [] };
      }
  
      const dumpsterRentals = allRentals
        .map(r => ({ ...r, _rentalStart: toDate(r.rentalDate), _rentalEnd: toDate(r.returnDate) }))
        .filter(r => r.dumpsterIds?.includes(d.id))
        .filter(r => r._rentalStart && r._rentalEnd)
        .sort((a, b) => (a._rentalStart!.getTime() - b._rentalStart!.getTime()));
  
      const activeRental = dumpsterRentals.find(r =>
        isWithinInterval(today, { start: startOfDay(r._rentalStart!), end: endOfDay(r._rentalEnd!) })
      );
  
      const overdueRental = dumpsterRentals.find(r => !activeRental && isAfter(today, endOfDay(r._rentalEnd!)));
  
      const futureRentals = dumpsterRentals.filter(r =>
        isAfter(startOfDay(r._rentalStart!), today)
      );
  
      let specialStatus = 'Disponível';
  
      if (activeRental) {
        if (isToday(activeRental._rentalEnd!)) {
          specialStatus = 'Encerra hoje';
        } else {
          specialStatus = 'Alugada';
        }
      } else if (overdueRental) {
        specialStatus = 'Em Atraso';
      } else if (futureRentals.length > 0) {
        specialStatus = 'Agendada';
      }
  
      const disabledRanges = dumpsterRentals.map(r => ({
        start: startOfDay(r._rentalStart!),
        end: endOfDay(r._rentalEnd!),
      })).filter(range => range.end >= range.start);
  
      const schedules = dumpsterRentals.map(r => {
        const start = r._rentalStart!;
        const end = r._rentalEnd!;
        let scheduleStatus = 'Reservada';
        if (isWithinInterval(today, { start: startOfDay(start), end: endOfDay(end) })) {
          scheduleStatus = 'Alugada';
        }
        return `${scheduleStatus} de ${format(start, 'dd/MM', { locale: ptBR })} a ${format(end, 'dd/MM', { locale: ptBR })}`;
      });
  
      return {
        ...d,
        disabled: d.status === 'Em Manutenção' || !!activeRental || !!overdueRental,
        specialStatus,
        disabledRanges,
        schedules,
      };
    });
  }, [dumpsters, allRentals]);

  const classifiedClients = useMemo(() => {
    const today = new Date();

    const activeClientIds = new Set([
        ...allRentals.map(r => r.clientId),
        ...allOperations.map(o => o.clientId)
    ]);
    
    const completedClientIds = new Set([
        ...allCompletedRentals.map(r => r.clientId),
        ...allCompletedOperations.map(o => o.clientId)
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
  }, [clients, allRentals, allOperations, allCompletedRentals, allCompletedOperations]);


  return (
    <div className="container mx-auto max-w-2xl py-8 px-4 md:px-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-2xl">Nova OS de aluguel</CardTitle>
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
          ) : (dumpsters.length > 0 && clients.length > 0) ? (
             <RentalForm 
                dumpsters={dumpstersForForm} 
                clients={clients}
                classifiedClients={classifiedClients}
                team={team} 
                trucks={trucks}
                rentalPrices={account?.rentalPrices}
                account={account}
                prefillData={prefillData}
                swapOriginId={swapOriginId}
             />
          ) : (
            <Alert>
              <Truck className="h-4 w-4" />
              <AlertTitle>Faltam informações para criar uma OS!</AlertTitle>
              <AlertDescription>
                {dumpsters.length === 0 && <p>Não há caçambas cadastradas. <Link href="/dumpsters" className="font-bold underline">Gerencie suas caçambas</Link>.</p>}
                {clients.length === 0 && <p>Não há clientes cadastrados. <Link href="/clients" className="font-bold underline">Cadastre um novo cliente</Link>.</p>}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function NewRentalPage() {
    return (
        <Suspense fallback={<div>Carregando...</div>}>
            <NewRentalPageContent />
        </Suspense>
    )
}
