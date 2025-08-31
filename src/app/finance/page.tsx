

'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import type { CompletedRental, Account, Attachment } from '@/lib/types';
import { getCompletedRentals } from '@/lib/data-server-actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, Truck, TrendingUp, ShieldAlert, FileText, CalendarDays, MapPin, User, Paperclip } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { RevenueByClientChart } from './revenue-by-client-chart';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { RentalAttachments } from '../rentals/rental-attachments';


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

function CompletedRentalDetailsDialog({ rental, isOpen, onOpenChange }: { rental: CompletedRental | null, isOpen: boolean, onOpenChange: (open: boolean) => void }) {
    if (!rental) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Detalhes da OS #{rental.sequentialId}</DialogTitle>
                    <DialogDescription>Finalizada em {format(parseISO(rental.completedDate), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
                     <div className="flex items-start gap-3">
                        <User className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                        <div className="flex flex-col">
                            <span className="text-sm text-muted-foreground">Cliente</span>
                            <span className="font-medium">{rental.client?.name}</span>
                        </div>
                    </div>
                     <div className="flex items-start gap-3">
                        <User className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                        <div className="flex flex-col">
                            <span className="text-sm text-muted-foreground">Responsável</span>
                            <span className="font-medium">{rental.assignedToUser?.name ?? 'N/A'}</span>
                        </div>
                    </div>
                     <div className="flex items-start gap-3">
                        <Truck className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                        <div className="flex flex-col">
                            <span className="text-sm text-muted-foreground">Caçamba</span>
                            <span className="font-medium">{rental.dumpster?.name} ({rental.dumpster?.size}m³)</span>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <MapPin className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                        <div className="flex flex-col">
                            <span className="text-sm text-muted-foreground">Endereço</span>
                            <span className="font-medium">{rental.deliveryAddress}</span>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <CalendarDays className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                        <div className="flex flex-col">
                            <span className="text-sm text-muted-foreground">Período</span>
                            <span className="font-medium">{format(parseISO(rental.rentalDate), 'dd/MM/yy')} - {format(parseISO(rental.returnDate), 'dd/MM/yy')} ({rental.rentalDays} dias)</span>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <DollarSign className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                        <div className="flex flex-col">
                            <span className="text-sm text-muted-foreground">Valor Total</span>
                            <span className="font-medium">{formatCurrency(rental.totalValue)}</span>
                        </div>
                    </div>
                    {rental.observations && (
                         <div className="flex items-start gap-3">
                            <FileText className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                            <div className="flex flex-col">
                                <span className="text-sm text-muted-foreground">Observações</span>
                                <p className="font-medium whitespace-pre-wrap">{rental.observations}</p>
                            </div>
                        </div>
                    )}
                    <Separator />
                    <div className="space-y-2">
                        <h4 className="font-medium flex items-center gap-2"><Paperclip className="h-4 w-4" /> Anexos</h4>
                        <RentalAttachments rental={rental} isCompleted={true} />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function FinancePage() {
    const { accountId, userAccount, loading: authLoading } = useAuth();
    const [completedRentals, setCompletedRentals] = useState<CompletedRental[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [selectedRental, setSelectedRental] = useState<CompletedRental | null>(null);

    const isAdmin = userAccount?.role === 'admin';
    const canAccess = isAdmin || userAccount?.permissions?.canAccessFinance;

    useEffect(() => {
        if (authLoading || !accountId || !canAccess) {
            if (!authLoading) setLoadingData(false);
            return;
        };

        async function fetchData() {
            setLoadingData(true);
            const rentals = await getCompletedRentals(accountId!);
            setCompletedRentals(rentals);
            setLoadingData(false);
        }
        
        fetchData();

    }, [accountId, authLoading, canAccess]);

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

    const revenueByClientData = completedRentals.reduce((acc, rental) => {
        if (!rental.client) return acc;
        const clientName = rental.client.name;
        const value = rental.totalValue;

        if (!acc[clientName]) {
            acc[clientName] = 0;
        }
        acc[clientName] += value;

        return acc;
    }, {} as Record<string, number>);

    const clientChartData = Object.entries(revenueByClientData).map(([name, value]) => ({
        name,
        value,
    })).sort((a,b) => b.value - a.value);


    const isLoading = authLoading || (loadingData && canAccess);

    if (!isLoading && !canAccess) {
         return (
            <div className="container mx-auto py-8 px-4 md:px-6">
                 <Alert variant="destructive">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>Acesso Negado</AlertTitle>
                    <AlertDescription>
                       Você não tem permissão para visualizar esta página.
                    </AlertDescription>
                </Alert>
            </div>
        )
    }

    return (
        <div className="container mx-auto py-8 px-4 md:px-6">
            <div className="mb-8">
                 <h1 className="text-3xl font-headline font-bold">Estatísticas</h1>
                 <p className="text-muted-foreground mt-1">Visualize as estatísticas e o desempenho do seu negócio.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
                 <StatCard title="Receita (Mês)" value={formatCurrency(monthlyRevenue)} icon={DollarSign} loading={isLoading} />
                 <StatCard title="Receita (Ano)" value={formatCurrency(yearlyRevenue)} icon={TrendingUp} loading={isLoading} />
                 <StatCard title="Aluguéis Finalizados (Mês)" value={String(monthlyCompletions)} icon={Truck} loading={isLoading} />
            </div>

             <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="font-headline">Faturamento por Cliente</CardTitle>
                        <CardDescription>Receita gerada por cada cliente no período total.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-[300px] w-full" /> : <RevenueByClientChart data={clientChartData} />}
                    </CardContent>
                </Card>
                <Card className="lg:col-span-3">
                    <CardHeader>
                        <CardTitle className="font-headline">Histórico de Faturamento</CardTitle>
                        <CardDescription>Lista de todos os aluguéis finalizados. Clique para ver detalhes.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-40 w-full" /> : (
                            <div className="overflow-x-auto">
                                <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>OS</TableHead>
                                        <TableHead>Cliente</TableHead>
                                        <TableHead className="text-right">Finalizado em</TableHead>
                                        <TableHead className="text-right">Valor</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {completedRentals.length > 0 ? completedRentals.map(rental => (
                                        <TableRow key={rental.id} onClick={() => setSelectedRental(rental)} className="cursor-pointer">
                                            <TableCell className="font-mono text-xs font-bold">{rental.sequentialId}</TableCell>
                                            <TableCell className="font-medium whitespace-nowrap">{rental.client?.name ?? 'N/A'}</TableCell>
                                            <TableCell className="text-right whitespace-nowrap">{format(parseISO(rental.completedDate), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                                            <TableCell className="text-right whitespace-nowrap">{formatCurrency(rental.totalValue)}</TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center h-24">Nenhum aluguel finalizado ainda.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
             </div>
             <CompletedRentalDetailsDialog rental={selectedRental} isOpen={!!selectedRental} onOpenChange={(open) => !open && setSelectedRental(null)} />
        </div>
    );
}
