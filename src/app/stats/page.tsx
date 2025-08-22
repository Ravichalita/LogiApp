
'use client';

import { useEffect, useState, useTransition, useMemo } from 'react';
import { useAuth } from '@/context/auth-context';
import { StatsDisplay } from './stats-display';
import type { CompletedRental, PopulatedCompletedRental } from '@/lib/types';
import { getPopulatedCompletedRentals } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, Trash2, TriangleAlert, History } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { resetBillingDataAction } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CompletedRentalsTable } from './completed-rentals-table';

function StatsSkeleton() {
    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card><CardHeader><Skeleton className="h-5 w-24 mb-2" /><Skeleton className="h-8 w-16" /></CardHeader></Card>
                <Card><CardHeader><Skeleton className="h-5 w-32 mb-2" /><Skeleton className="h-8 w-20" /></CardHeader></Card>
                <Card><CardHeader><Skeleton className="h-5 w-24 mb-2" /><Skeleton className="h-8 w-16" /></CardHeader></Card>
                <Card><CardHeader><Skeleton className="h-5 w-32 mb-2" /><Skeleton className="h-8 w-20" /></CardHeader></Card>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle><Skeleton className="h-6 w-48" /></CardTitle>
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-[350px] w-full" />
                </CardContent>
            </Card>
        </div>
    )
}

function ResetDataButton() {
    const { accountId } = useAuth();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const handleReset = () => {
        if (!accountId) return;
        startTransition(async () => {
            const result = await resetBillingDataAction(accountId);
             if (result.message === 'error') {
                toast({
                  title: 'Erro',
                  description: result.error,
                  variant: 'destructive',
                });
            } else {
                toast({
                    title: 'Sucesso',
                    description: 'Seus dados de faturamento foram zerados.',
                });
            }
        });
    };

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                 <Button variant="destructive" size="sm">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Zerar Dados
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        <TriangleAlert className="h-6 w-6 text-destructive" />
                        Você tem certeza absoluta?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        Essa ação não pode ser desfeita. Isso excluirá permanentemente **todos** os seus registros de aluguéis finalizados e zerará suas estatísticas de faturamento.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleReset} disabled={isPending} className="bg-destructive hover:bg-destructive/90">
                        {isPending ? 'Excluindo...' : 'Sim, excluir todos os dados'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}


export default function StatsPage() {
    const { accountId } = useAuth();
    const [completedRentals, setCompletedRentals] = useState<PopulatedCompletedRental[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (accountId) {
            setLoading(true);
            const unsubscribe = getPopulatedCompletedRentals(accountId, (data) => {
                setCompletedRentals(data);
                setLoading(false);
            });
            return () => unsubscribe();
        }
    }, [accountId]);

    const sortedCompletedRentals = useMemo(() => {
        return [...completedRentals].sort((a, b) => b.completedDate.getTime() - a.completedDate.getTime());
    }, [completedRentals]);

    return (
        <div className="container mx-auto py-8 px-4 md:px-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h1 className="text-3xl font-headline font-bold">Estatísticas</h1>
            </div>
            {loading ? (
                <StatsSkeleton />
            ) : completedRentals.length === 0 ? (
                <div className="text-center py-20 bg-card rounded-lg border">
                    <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h2 className="mt-4 text-xl font-semibold font-headline">Nenhum dado para exibir</h2>
                    <p className="mt-2 text-muted-foreground">Finalize aluguéis para começar a ver as estatísticas.</p>
                </div>
            ) : (
                <Tabs defaultValue="overview" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="overview">
                             <BarChart3 className="mr-2 h-4 w-4" />
                            Visão Geral
                        </TabsTrigger>
                        <TabsTrigger value="history">
                             <History className="mr-2 h-4 w-4" />
                            Histórico de Faturamento
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="overview" className="mt-6">
                        <StatsDisplay rentals={sortedCompletedRentals} />
                    </TabsContent>
                    <TabsContent value="history" className="mt-6">
                        <CompletedRentalsTable rentals={sortedCompletedRentals} />
                    </TabsContent>
                     {accountId && (
                        <div className="mt-8 flex justify-start">
                            <ResetDataButton />
                        </div>
                    )}
                </Tabs>
            )}
        </div>
    );
}
