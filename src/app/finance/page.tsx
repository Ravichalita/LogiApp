
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
import type { HistoricItem, Transaction, TransactionCategory, CompletedRental, PopulatedOperation, UserAccount, Account, RecurringTransactionProfile } from '@/lib/types';

// Components
import { FinanceDashboard } from './components/finance-dashboard';
import { TransactionsList } from './components/transactions-list';

export default function FinancePage() {
    const { accountId, userAccount, isSuperAdmin, loading: authLoading } = useAuth();
    const [loadingData, setLoadingData] = useState(true);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    
    // Financial Data
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [categories, setCategories] = useState<TransactionCategory[]>([]);
    const [recurringProfiles, setRecurringProfiles] = useState<RecurringTransactionProfile[]>([]);
    
    // Historic Data (Legacy/Detailed View)
    const [historicItems, setHistoricItems] = useState<HistoricItem[]>([]);
    const [team, setTeam] = useState<UserAccount[]>([]);
    const [account, setAccount] = useState<Account | null>(null);

    const permissions = userAccount?.permissions;
    const canAccessFinance = isSuperAdmin || permissions?.canAccessFinance;

    const handleTransactionChange = (updatedTransaction: Transaction | null, action: 'create' | 'update' | 'delete') => {
        if (action === 'delete' && updatedTransaction) {
            setTransactions(prev => prev.filter(t => t.id !== updatedTransaction.id));
        } else if (action === 'create' && updatedTransaction) {
            setTransactions(prev => [updatedTransaction, ...prev]);
        } else if (action === 'update' && updatedTransaction) {
            setTransactions(prev => prev.map(t => t.id === updatedTransaction.id ? updatedTransaction : t));
        } else {
             // Fallback for full refresh if needed (e.g., complex state changes)
             setRefreshTrigger(prev => prev + 1);
        }
    };

    // Kept for other components that might need full refresh
    const refreshData = () => {
        setRefreshTrigger(prev => prev + 1);
    };

    useEffect(() => {
        if (authLoading || !accountId || !canAccessFinance) {
            if (!authLoading) setLoadingData(false);
            return;
        }

        async function fetchData() {
            // Only show full loading if it's the first load or if we explicitly want to block UI
            // But we keep loadingData for initial skeleton
            // If transactions already exist, we might not want to set loadingData=true again to avoid flicker
            // unless permissions/account change.
            if (transactions.length === 0 && historicItems.length === 0) {
                 setLoadingData(true);
            }

            try {
                const [
                    fetchedTransactions,
                    fetchedCategories,
                    rentals,
                    operations,
                    teamData,
                    accountData
                ] = await Promise.all([
                    getTransactions(accountId!, selectedDate.getMonth(), selectedDate.getFullYear()),
                    getFinancialCategories(accountId!),
                    permissions?.canAccessRentals ? getCompletedRentals(accountId!) : Promise.resolve([]),
                    permissions?.canAccessOperations ? getCompletedOperations(accountId!) : Promise.resolve([]),
                    fetchTeamMembers(accountId!),
                    getAccountData(accountId!),
                ]);

                setTransactions(fetchedTransactions);
                setCategories(fetchedCategories);
                setRecurringProfiles(accountData?.recurringTransactionProfiles || []);
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
    }, [accountId, authLoading, canAccessFinance, permissions, refreshTrigger, selectedDate]);

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
                <TabsList className="grid w-full grid-cols-2 lg:w-[400px] mb-6">
                    <TabsTrigger value="dashboard">
                        <BarChart3 className="h-4 w-4 mr-2" />
                        <span className="hidden sm:inline">Dashboard</span>
                    </TabsTrigger>
                    <TabsTrigger value="transactions">
                        <ListTodo className="h-4 w-4 mr-2" />
                        <span className="hidden sm:inline">Transações</span>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="dashboard">
                    <FinanceDashboard
                        transactions={transactions}
                        historicItems={historicItems}
                        team={team}
                        account={account}
                        permissions={permissions}
                        isSuperAdmin={isSuperAdmin}
                    />
                </TabsContent>

                <TabsContent value="transactions">
                    <TransactionsList
                        transactions={transactions}
                        categories={categories}
                        recurringProfiles={recurringProfiles}
                        onTransactionChange={handleTransactionChange}
                        onRefresh={refreshData}
                        selectedDate={selectedDate}
                        onDateChange={setSelectedDate}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
