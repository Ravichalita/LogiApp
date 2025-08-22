
'use client';

import { useEffect, useState, useTransition, useMemo } from 'react';
import { useAuth } from '@/context/auth-context';
import { StatsDisplay } from './stats-display';
import type { PopulatedCompletedRental, Account } from '@/lib/types';
import { getPopulatedCompletedRentals, getAccount } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, Trash2, TriangleAlert, History, DollarSign } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CompletedRentalsTable } from './completed-rentals-table';
import { DefaultPriceForm } from './default-price-form';
import { resetBillingDataAction } from '@/lib/actions';


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

export default function FinancePage() {
    const { accountId, loading: authLoading, userAccount } = useAuth();
    const [completedRentals, setCompletedRentals] = useState<PopulatedCompletedRental[]>([]);
    const [account, setAccount] = useState<Account | null>(null);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const isAdmin = userAccount?.role === 'admin';
    
    useEffect(() => {
        if (!accountId) {
            setCompletedRentals([]);
            return;
        };

        const unsubscribeRentals = getPopulatedCompletedRentals(accountId, (data) => {
            setCompletedRentals(data);
        });

        let unsubscribeAccount: () => void;
        if (isAdmin) {
             unsubscribeAccount = getAccount(accountId, (data) => {
                setAccount(data);
            });
        }
        
        return () => {
            unsubscribeRentals();
            if (unsubscribeAccount) {
                unsubscribeAccount();
            }
        }
        
    }, [accountId, isAdmin]);

    const sortedCompletedRentals = useMemo(() => {
        return [...completedRentals].sort((a, b) => b.completedDate.getTime() - a.completedDate.getTime());
    }, [completedRentals]);
    
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

    if (authLoading) {
        return (
             <div className="container mx-auto py-8 px-4 md:px-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <h1 className="text-3xl font-headline font-bold">Financeiro</h1>
                </div>
                <StatsSkeleton />
            </div>
        )
    }

    return (
        <div className="container mx-auto py-8 px-4 md:px-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h1 className="text-3xl font-headline font-bold">Financeiro</h1>
            </div>
            
            {isAdmin && account && (
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <DollarSign className="h-5 w-5" />
                            Preço Padrão da Diária
                        </CardTitle>
                        <CardDescription>
                            Defina um valor padrão para ser usado ao criar novos aluguéis.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <DefaultPriceForm account={account} />
                    </CardContent>
                </Card>
            )}

            {completedRentals.length === 0 ? (
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
                </Tabs>
            )}
             {isAdmin && accountId && (
                <div className="mt-8 flex justify-start">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Zerar Dados de Faturamento
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
                </div>
            )}
        </div>
    );
}
