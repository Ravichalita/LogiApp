
'use client';

import { useEffect, useState, useMemo } from 'react';
import { fetchClients, getDumpsters, getRentals, fetchTeamMembers, getAccount } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RentalForm, type DumpsterForForm } from './rental-form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Truck } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { Skeleton } from '@/components/ui/skeleton';
import type { Client, Dumpster, Rental, UserAccount, Account } from '@/lib/types';
import { isAfter, isToday, parseISO, startOfDay, format, isWithinInterval, isBefore, endOfDay, subDays } from 'date-fns';

export default function NewRentalPage() {
  const { accountId } = useAuth();
  const [dumpsters, setDumpsters] = useState<Dumpster[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [team, setTeam] = useState<UserAccount[]>([]);
  const [allRentals, setAllRentals] = useState<Rental[]>([]);
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (accountId) {
      const fetchData = async () => {
        setLoading(true);
        const userClients = await fetchClients(accountId);
        setClients(userClients);

        const teamMembers = await fetchTeamMembers(accountId);
        setTeam(teamMembers);
        
        const unsubAccount = getAccount(accountId, (acc) => {
            setAccount(acc);
            // set loading false only after account is fetched
            setLoading(false);
        });
        const unsubDumpsters = getDumpsters(accountId, setDumpsters);
        const unsubRentals = getRentals(accountId, setAllRentals);
        
        return () => {
          unsubDumpsters();
          unsubRentals();
          unsubAccount();
        }
      };
      fetchData();
    } else {
        setLoading(false);
        setDumpsters([]);
        setClients([]);
        setAllRentals([]);
        setTeam([]);
        setAccount(null);
    }
  }, [accountId]);


  const dumpstersForForm = useMemo((): DumpsterForForm[] => {
    const today = startOfDay(new Date());

    return dumpsters.map(d => {
        if (d.status === 'Em Manutenção') {
            return { ...d, specialStatus: "Em Manutenção", disabled: true, disabledRanges: [] };
        }

        const dumpsterRentals = allRentals
            .filter(r => r.dumpsterId === d.id)
            .filter(r => isAfter(endOfDay(parseISO(r.returnDate)), today) || isToday(parseISO(r.returnDate)));

        const disabledRanges = dumpsterRentals.map(r => ({
            from: startOfDay(parseISO(r.rentalDate)),
            to: endOfDay(parseISO(r.returnDate)),
        }));

        const sortedRentals = dumpsterRentals.sort((a,b) => parseISO(a.rentalDate).getTime() - parseISO(b.rentalDate).getTime());
        const currentOrNextRental = sortedRentals.find(r => isAfter(endOfDay(parseISO(r.returnDate)), today) || isToday(parseISO(r.returnDate)));
        
        let specialStatus: string | undefined = undefined;

        if (currentOrNextRental) {
            const rentalStart = startOfDay(parseISO(currentOrNextRental.rentalDate));
            const rentalEnd = endOfDay(parseISO(currentOrNextRental.returnDate));

            if (isWithinInterval(today, { start: rentalStart, end: rentalEnd })) {
                if (isToday(rentalEnd)) {
                    specialStatus = `Encerra hoje`;
                } else {
                    specialStatus = `Alugada até ${format(rentalEnd, 'dd/MM/yy')}`;
                }
            } else if (isBefore(today, rentalStart)) {
                specialStatus = `Reservada para ${format(rentalStart, 'dd/MM/yy')}`;
            }
        }

        return { 
            ...d, 
            disabled: d.status === 'Em Manutenção',
            specialStatus,
            disabledRanges,
        };
    });
}, [dumpsters, allRentals]);

  return (
    <div className="container mx-auto max-w-2xl py-8 px-4 md:px-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-2xl">Novo Aluguel</CardTitle>
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
                team={team} 
                rentalPrices={account?.rentalPrices}
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
