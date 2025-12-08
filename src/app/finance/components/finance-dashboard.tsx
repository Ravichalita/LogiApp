
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUp, ArrowDown, DollarSign, Wallet } from 'lucide-react';
import { Transaction, HistoricItem, UserAccount, Account, Permissions } from '@/lib/types';
import { format, subMonths, startOfYear, max, endOfDay, startOfDay, parseISO } from 'date-fns';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Bar, Legend, ComposedChart, Line } from 'recharts';
import { OperationalHistory } from './operational-history';
import { getTransactions } from '@/lib/data-server-actions';
import { Skeleton } from '@/components/ui/skeleton';

function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
}

interface FinanceDashboardProps {
    transactions: Transaction[]; // These are the dashboard-filtered transactions
    historicItems: HistoricItem[];
    team: UserAccount[];
    account: Account | null;
    permissions: Permissions | undefined;
    isSuperAdmin: boolean;
}

type ChartPeriod = 'dashboard' | '6m' | '6m-current' | '1y';

export function FinanceDashboard({ transactions, historicItems, team, account, permissions, isSuperAdmin }: FinanceDashboardProps) {
    // #region Top Metrics (Always follow Dashboard Filter)
    const totalIncome = transactions
        .filter(t => t.type === 'income' && t.status !== 'cancelled')
        .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = transactions
        .filter(t => t.type === 'expense' && t.status !== 'cancelled')
        .reduce((sum, t) => sum + t.amount, 0);

    const balance = totalIncome - totalExpenses;

    const pendingIncome = transactions
        .filter(t => t.type === 'income' && t.status === 'pending')
        .reduce((sum, t) => sum + t.amount, 0);

    const pendingExpenses = transactions
        .filter(t => t.type === 'expense' && (t.status === 'pending' || t.status === 'overdue'))
        .reduce((sum, t) => sum + t.amount, 0);
    // #endregion

    // #region Charts Logic
    const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('6m');
    const [chartTransactions, setChartTransactions] = useState<Transaction[]>([]);
    const [loadingCharts, setLoadingCharts] = useState(false);

    const accountId = account?.id;

    // Effect to handle chart data source
    useEffect(() => {
        let isMounted = true;

        async function fetchChartData() {
            if (!accountId) return;

            if (chartPeriod === 'dashboard') {
                setChartTransactions(transactions);
                return;
            }

            setLoadingCharts(true);
            try {
                let startDate: Date;
                const endDate = endOfDay(new Date());

                if (chartPeriod === '6m') {
                    startDate = subMonths(new Date(), 6);
                } else if (chartPeriod === '6m-current') {
                    // Max between 6 months ago and start of current year
                    const sixMonthsAgo = subMonths(new Date(), 6);
                    const startOfCurrentYear = startOfYear(new Date());
                    startDate = max([sixMonthsAgo, startOfCurrentYear]);
                } else { // '1y'
                    startDate = subMonths(new Date(), 12);
                }

                // Ensure startDate is start of day
                startDate = startOfDay(startDate);

                const data = await getTransactions(accountId, {
                    startDate: format(startDate, 'yyyy-MM-dd'),
                    endDate: format(endDate, 'yyyy-MM-dd'),
                });

                if (isMounted) {
                    setChartTransactions(data);
                }
            } catch (error) {
                console.error("Failed to fetch chart transactions:", error);
            } finally {
                if (isMounted) {
                    setLoadingCharts(false);
                }
            }
        }

        fetchChartData();

        return () => { isMounted = false; };
    }, [chartPeriod, accountId, transactions]); // Depend on transactions so if we switch back to 'dashboard' we have latest

    // Process data for charts
    const chartData = React.useMemo(() => {
        const monthlyDataMap = new Map<string, { name: string, income: number, expense: number }>();

        // Sort transactions by date first to ensure correct accumulation if we did that,
        // but here we group by month
        const sortedTrans = [...chartTransactions].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

        sortedTrans
            .filter(t => t.status !== 'cancelled')
            .forEach(t => {
                const date = new Date(t.dueDate);
                const key = format(date, 'yyyy-MM');
                const label = format(date, 'MMM/yy');

                if (!monthlyDataMap.has(key)) {
                    monthlyDataMap.set(key, { name: label, income: 0, expense: 0 });
                }

                const entry = monthlyDataMap.get(key)!;
                if (t.type === 'income') entry.income += t.amount;
                else entry.expense += t.amount;
            });

        // Convert to array and calculate balance
        const data = Array.from(monthlyDataMap.keys())
            .sort()
            .map(key => {
                const entry = monthlyDataMap.get(key)!;
                return {
                    ...entry,
                    balance: entry.income - entry.expense
                };
            });

        return data;
    }, [chartTransactions]);
    // #endregion

    const ChartSelector = () => (
        <Select value={chartPeriod} onValueChange={(v) => setChartPeriod(v as ChartPeriod)}>
            <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="dashboard">Seguir Dashboard</SelectItem>
                <SelectItem value="6m">Últimos 6 Meses</SelectItem>
                <SelectItem value="6m-current">6 Meses (Ano Atual)</SelectItem>
                <SelectItem value="1y">Último Ano</SelectItem>
            </SelectContent>
        </Select>
    );

    return (
        <div className="space-y-8">
            <section className="space-y-6">
                <div className="flex items-center justify-between">
                     <h2 className="text-xl font-semibold tracking-tight">Visão Financeira (Caixa)</h2>
                </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Saldo Total</CardTitle>
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(balance)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Receitas - Despesas (inclui pendentes)
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Receitas</CardTitle>
                        <ArrowUp className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(totalIncome)}</div>
                        <p className="text-xs text-muted-foreground">
                            A receber: {formatCurrency(pendingIncome)}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Despesas</CardTitle>
                        <ArrowDown className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(totalExpenses)}</div>
                        <p className="text-xs text-muted-foreground">
                            A pagar: {formatCurrency(pendingExpenses)}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Lucratividade</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {totalIncome > 0 ? ((balance / totalIncome) * 100).toFixed(1) : 0}%
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Margem de Lucro
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card className="col-span-2 md:col-span-1">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-base">Fluxo de Caixa</CardTitle>
                        <ChartSelector />
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        {loadingCharts ? (
                            <div className="w-full h-full flex items-center justify-center">
                                <Skeleton className="w-full h-full" />
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                                    <Legend />
                                    <Bar dataKey="income" name="Receitas" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={20} />
                                    <Bar dataKey="expense" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
                                    <Line
                                        type="monotone"
                                        dataKey="balance"
                                        name="Saldo Líquido"
                                        stroke="#3b82f6"
                                        strokeWidth={2}
                                        dot={{ r: 4 }}
                                    />
                                </ComposedChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>
                 <Card className="col-span-2 md:col-span-1">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-base">Evolução do Saldo</CardTitle>
                        <ChartSelector />
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        {loadingCharts ? (
                             <div className="w-full h-full flex items-center justify-center">
                                <Skeleton className="w-full h-full" />
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                                    <Area
                                        type="monotone"
                                        dataKey="balance"
                                        name="Saldo Líquido"
                                        stroke="#3b82f6"
                                        fillOpacity={1}
                                        fill="url(#colorBalance)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>
            </div>
            </section>

            <Separator />

            <section className="space-y-6">
                <div className="flex items-center justify-between">
                     <h2 className="text-xl font-semibold tracking-tight">Histórico Operacional</h2>
                </div>
                <OperationalHistory
                    items={historicItems}
                    team={team}
                    account={account}
                    permissions={permissions}
                    isSuperAdmin={isSuperAdmin}
                />
            </section>
        </div>
    );
}
