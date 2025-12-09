
'use client';

import React, { useEffect, useState, Suspense, useMemo } from 'react';
import { useAuth } from '@/context/auth-context';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { ShieldAlert, BarChart3, ListTodo } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { DateRange } from 'react-day-picker';

// Server Actions
import { getTransactions, getFinancialCategories, fetchTrucksAction } from '@/lib/data-server-actions';
import { getCompletedRentals, getCompletedOperations } from '@/lib/data-server-actions';
import { fetchTeamMembers, getAccountData } from '@/lib/data';

// Types
import type { HistoricItem, Transaction, TransactionCategory, UserAccount, Account, RecurringTransactionProfile, Truck } from '@/lib/types';

// Components
import { FinanceDashboard } from './components/finance-dashboard';
import { TransactionsList } from './components/transactions-list';
import { PeriodSelector, PeriodType } from './components/period-selector';


export default function FinancePage() {
    const { accountId, userAccount, isSuperAdmin, loading: authLoading } = useAuth();
    const [loadingData, setLoadingData] = useState(true);
    const [loadingTransactions, setLoadingTransactions] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    
    // Transactions Tab State
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());

    // Dashboard Tab State
    const [dashboardPeriodType, setDashboardPeriodType] = useState<PeriodType>('month');
    const [dashboardSelectedDate, setDashboardSelectedDate] = useState<Date>(new Date());
    const [dashboardDateRange, setDashboardDateRange] = useState<DateRange | undefined>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date())
    });
    const [dashboardTransactions, setDashboardTransactions] = useState<Transaction[]>([]);
    const [loadingDashboardTransactions, setLoadingDashboardTransactions] = useState(false);

    // URL State for Tabs
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const currentTab = searchParams.get('tab') || 'dashboard';

    const handleTabChange = (value: string) => {
        const params = new URLSearchParams(searchParams);
        params.set('tab', value);
        router.push(`${pathname}?${params.toString()}`);
    };

    // Financial Data
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [categories, setCategories] = useState<TransactionCategory[]>([]);
    const [recurringProfiles, setRecurringProfiles] = useState<RecurringTransactionProfile[]>([]);
    
    // Historic Data (Legacy/Detailed View)
    const [historicItems, setHistoricItems] = useState<HistoricItem[]>([]);
    const [team, setTeam] = useState<UserAccount[]>([]);
    const [trucks, setTrucks] = useState<Truck[]>([]);
    const [account, setAccount] = useState<Account | null>(null);

    const permissions = userAccount?.permissions;
    const canAccessFinance = isSuperAdmin || permissions?.canAccessFinance;

    const handleTransactionChange = (updatedTransaction: Transaction | null, action: 'create' | 'update' | 'delete') => {
        // Update main transaction list
        if (action === 'delete' && updatedTransaction) {
            setTransactions(prev => prev.filter(t => t.id !== updatedTransaction.id));
        } else if (action === 'create' && updatedTransaction) {
            setTransactions(prev => [updatedTransaction, ...prev]);
        } else if (action === 'update' && updatedTransaction) {
            setTransactions(prev => prev.map(t => t.id === updatedTransaction.id ? updatedTransaction : t));
        } else {
             setRefreshTrigger(prev => prev + 1);
        }

        // Also trigger dashboard refresh (simplified)
        // Ideally we would optimize this to not re-fetch if not needed, but safe to fetch
        fetchDashboardTransactions();
    };

    const fetchAllData = async () => {
        if (!accountId) return;

        try {
            const [
                fetchedCategories,
                rentals,
                operations,
                teamData,
                accountData,
                fetchedTransactions,
                trucksData
            ] = await Promise.all([
                getFinancialCategories(accountId),
                permissions?.canAccessRentals ? getCompletedRentals(accountId) : Promise.resolve([]),
                permissions?.canAccessOperations ? getCompletedOperations(accountId) : Promise.resolve([]),
                fetchTeamMembers(accountId),
                getAccountData(accountId),
                getTransactions(accountId, selectedDate.getMonth(), selectedDate.getFullYear()),
                fetchTrucksAction(accountId)
            ]);

            setCategories(fetchedCategories);
            setRecurringProfiles(accountData?.recurringTransactionProfiles || []);
            setTeam(teamData);
            setAccount(accountData);
            setTransactions(fetchedTransactions);
            setTrucks(trucksData);

            // Also load dashboard transactions initially
            await fetchDashboardTransactions();

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
                    completedDate: o.completedAt || '',
                    totalValue: o.value ?? 0,
                    sequentialId: o.sequentialId,
                    operationTypes: o.operationTypes,
                    data: o,
                }))
            ];
            combinedItems.sort((a, b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime());
            setHistoricItems(combinedItems);

        } catch (error) {
            console.error("Failed to fetch all finance data:", error);
        }
    };

    async function fetchDashboardTransactions() {
        if (!accountId || !dashboardDateRange?.from || !dashboardDateRange?.to) return;

        setLoadingDashboardTransactions(true);
        try {
            const startDate = format(dashboardDateRange.from, 'yyyy-MM-dd');
            const endDate = format(dashboardDateRange.to, 'yyyy-MM-dd');

            const data = await getTransactions(accountId, {
                startDate,
                endDate
            });
            setDashboardTransactions(data);
        } catch (error) {
            console.error("Failed to fetch dashboard transactions:", error);
        } finally {
            setLoadingDashboardTransactions(false);
        }
    }

    // Initial data load
    useEffect(() => {
        if (authLoading || !accountId || !canAccessFinance) {
            if (!authLoading) setLoadingData(false);
            return;
        }
        
        async function initialLoad() {
            setLoadingData(true);
            await fetchAllData();
            setLoadingData(false);
        }
        initialLoad();
    }, [accountId, authLoading, canAccessFinance, permissions]);

    // Subsequent refreshes (soft)
    useEffect(() => {
        if (refreshTrigger > 0) {
            fetchAllData();
        }
    }, [refreshTrigger]);

    // Dashboard Data Fetching (When filter changes)
    useEffect(() => {
        if (!loadingData && accountId) {
            fetchDashboardTransactions();
        }
    }, [dashboardDateRange, accountId]); // Intentionally not including loadingData as dep to avoid loop, but guard inside

    // Transactions Tab Data Fetching
    useEffect(() => {
        if (authLoading || !accountId || !canAccessFinance || loadingData) {
            return;
        }

        async function fetchTransactionsData() {
            setLoadingTransactions(true);
            try {
                const fetchedTransactions = await getTransactions(accountId!, selectedDate.getMonth(), selectedDate.getFullYear());
                setTransactions(fetchedTransactions);
            } catch (error) {
                console.error("Failed to fetch transactions:", error);
            } finally {
                setLoadingTransactions(false);
            }
        }
        
        // Skip the very first render's fetch since initialLoad handles it
        if (!loadingData && refreshTrigger === 0) {
            fetchTransactionsData();
        }
    }, [selectedDate, loadingData]);


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

            <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                    <TabsList className="grid w-full sm:w-[400px] grid-cols-2">
                        <TabsTrigger value="dashboard">
                            <BarChart3 className="h-4 w-4 mr-2" />
                            <span className="hidden sm:inline">Dashboard</span>
                        </TabsTrigger>
                        <TabsTrigger value="transactions">
                            <ListTodo className="h-4 w-4 mr-2" />
                            <span className="hidden sm:inline">Transações</span>
                        </TabsTrigger>
                    </TabsList>

                    {currentTab === 'dashboard' && (
                        <PeriodSelector
                            periodType={dashboardPeriodType}
                            onPeriodTypeChange={setDashboardPeriodType}
                            dateRange={dashboardDateRange}
                            onDateRangeChange={setDashboardDateRange}
                            selectedDate={dashboardSelectedDate}
                            onSelectedDateChange={setDashboardSelectedDate}
                        />
                    )}
                </div>

                <TabsContent value="dashboard" className="relative">
                    {loadingDashboardTransactions && (
                         <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10 rounded-lg">
                            <div className="bg-background p-4 rounded-lg shadow-lg border">
                                <span className="text-sm font-medium">Carregando dados...</span>
                            </div>
                        </div>
                    )}
                    <FinanceDashboard
                        transactions={dashboardTransactions} // Pass the filtered dashboard transactions
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
                        team={team}
                        trucks={trucks}
                        onTransactionChange={handleTransactionChange}
                        onRefresh={() => setRefreshTrigger(t => t + 1)}
                        selectedDate={selectedDate}
                        onDateChange={setSelectedDate}
                    />
                     {loadingTransactions && (
                        <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
                            <Skeleton className="h-full w-full opacity-20" />
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background p-4 rounded-lg shadow-lg">
                                Carregando transações...
                            </div>
                        </div>
                     )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
