
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import type { CompletedRental, Account } from '@/lib/types';
import { getCompletedRentals, getAccount } from '@/lib/data-server-actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, Truck, TrendingUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { RentalPricesForm } from './rental-prices-form';

function formatCurrency(value: number | undefined | null) {
    if (value === undefined || value === null) {
        return "R$ 0,00";
    }
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
}

function StatCard({ title, value, icon: Icon, loading }: { title: string, value: string, icon: React.ElementType, loading: boolean }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                {loading ? (
                    <Skeleton className="h-8 w-3/4" />
                ) : (
                    <div className="text-2xl font-bold">{value}</div>
                )}
            </CardContent>
        </Card>
    )
}

export default function FinancePage() {
    const { accountId, loading: authLoading } = useAuth();
    const [completedRentals, setCompletedRentals] = useState<CompletedRental[]>([]);
    const [account, setAccount] = useState<Account | null>(null);
    const [loadingData, setLoadingData] = useState(true);

    useEffect(() => {
        if (authLoading || !accountId) {
            if (!authLoading) setLoadingData(false);
            return;
        };

        async function fetchData() {
            setLoadingData(true);
            const [rentals, accountData] = await Promise.all([
                getCompletedRentals(accountId!),
                getAccount(accountId!)
            ]);
            setCompletedRentals(rentals);
            setAccount(accountData);
            setLoadingData(false);
        }
        
        fetchData();

    }, [accountId, authLoading]);

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyRevenue = completedRentals
        .filter(r => {
            const completedDate = parseISO(r.completedDate);
            return completedDate.getMonth() === currentMonth && completedDate.getFullYear() === currentYear;
        })
        .reduce((acc, r) => acc + r.totalValue, 0);

    const yearlyRevenue = completedRentals
        .filter(r => {
             const completedDate = parseISO(r.completedDate);
             return completedDate.getFullYear() === currentYear;
        })
        .reduce((acc, r) => acc + r.totalValue, 0);
    
    const monthlyCompletions = completedRentals
        .filter(r => {
             const completedDate = parseISO(r.completedDate);
             return completedDate.getMonth() === currentMonth && completedDate.getFullYear() === currentYear;
        }).length;


    const isLoading = authLoading || loadingData;

    return (
        <div className="container mx-auto py-8 px-4 md:px-6">
            <div className="mb-6">
                 <h1 className="text-3xl font-headline font-bold">Controle Financeiro</h1>
                 <p className="text-muted-foreground mt-1">Visualize o desempenho financeiro do seu negócio.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
                 <StatCard title="Receita (Mês)" value={formatCurrency(monthlyRevenue)} icon={DollarSign} loading={isLoading} />
                 <StatCard title="Receita (Ano)" value={formatCurrency(yearlyRevenue)} icon={TrendingUp} loading={isLoading} />
                 <StatCard title="Aluguéis Finalizados (Mês)" value={String(monthlyCompletions)} icon={Truck} loading={isLoading} />
            </div>

             <div className="grid gap-6 lg:grid-cols-5">
                <div className="lg:col-span-3">
                    <Card>
                        <CardHeader>
                            <CardTitle>Histórico de Faturamento</CardTitle>
                            <CardDescription>Lista de todos os aluguéis finalizados.</CardDescription>
                        </CardHeader>
                        <CardContent>
                           {isLoading ? <Skeleton className="h-40 w-full" /> : (
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Cliente</TableHead>
                                        <TableHead className="text-right">Finalizado em</TableHead>
                                        <TableHead className="text-right">Valor Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {completedRentals.length > 0 ? completedRentals.map(rental => (
                                        <TableRow key={rental.id}>
                                            <TableCell className="font-medium">{rental.client?.name ?? 'N/A'}</TableCell>
                                            <TableCell className="text-right">{format(parseISO(rental.completedDate), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(rental.totalValue)}</TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center h-24">Nenhum aluguel finalizado ainda.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                           )}
                        </CardContent>
                    </Card>
                </div>
                <div className="lg:col-span-2">
                     <Card>
                        <CardHeader>
                            <CardTitle>Configurações</CardTitle>
                             <CardDescription>Ajustes de preços e custos para o sistema.</CardDescription>
                        </CardHeader>
                        <CardContent>
                           {isLoading || !account ? <Skeleton className="h-40 w-full" /> : <RentalPricesForm account={account} />}
                        </CardContent>
                    </Card>
                </div>
             </div>
        </div>
    );
}
