
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/auth-context';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { ShieldAlert, BarChart3, ListTodo, Wallet, History as HistoryIcon, Settings2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

// Server Actions
import { getTransactions, getFinancialCategories } from '@/lib/data-server-actions';
import { getCompletedRentals, getCompletedOperations, getCityFromAddressAction, getNeighborhoodFromAddressAction } from '@/lib/data-server-actions';
import { fetchTeamMembers, getAccountData } from '@/lib/data';

// Types
import type { HistoricItem, Transaction, TransactionCategory, CompletedRental, PopulatedOperation, UserAccount, Account } from '@/lib/types';

// Components
import { FinanceDashboard } from './components/finance-dashboard';
import { TransactionsList } from './components/transactions-list';
import { CategoriesSettings } from './components/categories-settings';
import { default as HistoricView } from './components/historic-view'; // We'll move the old page content here

export default function FinancePage() {
    const { accountId, userAccount, isSuperAdmin, loading: authLoading } = useAuth();
    const [loadingData, setLoadingData] = useState(true);
    
    // Financial Data
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [categories, setCategories] = useState<TransactionCategory[]>([]);
    
    // Historic Data (Legacy/Detailed View)
    const [historicItems, setHistoricItems] = useState<HistoricItem[]>([]);
    const [team, setTeam] = useState<UserAccount[]>([]);
    const [account, setAccount] = useState<Account | null>(null);

    const permissions = userAccount?.permissions;
    const canAccessFinance = isSuperAdmin || permissions?.canAccessFinance;

    useEffect(() => {
        if (authLoading || !accountId || !canAccessFinance) {
            if (!authLoading) setLoadingData(false);
            return;
        }

        async function fetchData() {
            setLoadingData(true);
            try {
                const [
                    fetchedTransactions,
                    fetchedCategories,
                    rentals,
                    operations,
                    teamData,
                    accountData
                ] = await Promise.all([
                    getTransactions(accountId!),
                    getFinancialCategories(accountId!),
                    permissions?.canAccessRentals ? getCompletedRentals(accountId!) : Promise.resolve([]),
                    permissions?.canAccessOperations ? getCompletedOperations(accountId!) : Promise.resolve([]),
                    fetchTeamMembers(accountId!),
                    getAccountData(accountId!),
                ]);

                setTransactions(fetchedTransactions);
                setCategories(fetchedCategories);
                setTeam(teamData);
                setAccount(accountData);

                // Process Historic Items
                const combinedItems: HistoricItem[] = [
                    ...rentals.map(r => ({
                        id: r.id,
                        kind: 'rental' as const,
                        prefix: 'AL',
                        clientName: r.client?.name ?? 'N/A',
                        completedDate: r.completedDate,
                        totalValue: r.totalValue,
                        sequentialId: r.sequentialId,
                        data: r,
                    })),
                    ...operations.map(o => ({
                        id: o.id,
                        kind: 'operation' as const,
                        prefix: 'OP',
                        clientName: o.client?.name ?? 'N/A',
                        completedDate: o.completedAt,
                        totalValue: o.value ?? 0,
                        sequentialId: o.sequentialId,
                        operationTypes: o.operationTypes,
                        data: o,
                    }))
                ];
                combinedItems.sort((a, b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime());
                setHistoricItems(combinedItems);

            } catch (error) {
                console.error("Failed to fetch finance data:", error);
            } finally {
                setLoadingData(false);
            }
        }

        fetchData();
    }, [accountId, authLoading, canAccessFinance, permissions]);

    if (authLoading || (loadingData && canAccessFinance)) {
        return (
            <div className="container mx-auto py-8 px-4 md:px-6 space-y-6">
                <Skeleton className="h-12 w-48" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    if (!canAccessFinance) {
        return (
            <div className="container mx-auto py-8 px-4 md:px-6">
                <Alert variant="destructive">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>Acesso Negado</AlertTitle>
                    <AlertDescription>Você não tem permissão para visualizar esta página.</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8 px-4 md:px-6">
            <div className="mb-8">
                <h1 className="text-3xl font-headline font-bold">Gestão Financeira</h1>
                <p className="text-muted-foreground mt-1">Controle completo de receitas, despesas e histórico operacional.</p>
            </div>

            <Tabs defaultValue="dashboard" className="w-full">
                <TabsList className="grid w-full grid-cols-4 lg:w-[600px] mb-6">
                    <TabsTrigger value="dashboard">
                        <BarChart3 className="h-4 w-4 mr-2" />
                        <span className="hidden sm:inline">Dashboard</span>
                    </TabsTrigger>
                    <TabsTrigger value="transactions">
                        <ListTodo className="h-4 w-4 mr-2" />
                        <span className="hidden sm:inline">Transações</span>
                    </TabsTrigger>
                    <TabsTrigger value="categories">
                        <Settings2 className="h-4 w-4 mr-2" />
                        <span className="hidden sm:inline">Categorias</span>
                    </TabsTrigger>
                    <TabsTrigger value="history">
                        <HistoryIcon className="h-4 w-4 mr-2" />
                        <span className="hidden sm:inline">Histórico OS</span>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="dashboard">
                    <FinanceDashboard transactions={transactions} />
                </TabsContent>

                <TabsContent value="transactions">
                    <TransactionsList transactions={transactions} categories={categories} />
                </TabsContent>

                <TabsContent value="categories">
                    <CategoriesSettings categories={categories} />
                </TabsContent>

                <TabsContent value="history">
                    <HistoricView
                        items={historicItems}
                        team={team}
                        account={account}
                        permissions={permissions}
                        isSuperAdmin={isSuperAdmin}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
