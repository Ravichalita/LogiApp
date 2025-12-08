
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ArrowUp, ArrowDown, DollarSign, Wallet } from 'lucide-react';
import { Transaction, HistoricItem, UserAccount, Account, Permissions } from '@/lib/types';
import { format } from 'date-fns';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Legend } from 'recharts';
import { OperationalHistory } from './operational-history';

function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
}

interface FinanceDashboardProps {
    transactions: Transaction[];
    historicItems: HistoricItem[];
    team: UserAccount[];
    account: Account | null;
    permissions: Permissions | undefined;
    isSuperAdmin: boolean;
}

export function FinanceDashboard({ transactions, historicItems, team, account, permissions, isSuperAdmin }: FinanceDashboardProps) {
    // Summary Metrics
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

    // Chart Data Preparation (Monthly)
    const monthlyDataMap = new Map<string, { name: string, income: number, expense: number }>();

    transactions
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

    const chartData = Array.from(monthlyDataMap.keys())
        .sort()
        .map(key => monthlyDataMap.get(key)!);
        // Removed .slice(-6) to show all data within the selected period

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
                    <CardHeader>
                        <CardTitle>Fluxo de Caixa (Período Selecionado)</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                                <Legend />
                                <Bar dataKey="income" name="Receitas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="expense" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                 <Card className="col-span-2 md:col-span-1">
                    <CardHeader>
                        <CardTitle>Evolução do Saldo</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
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
                                    dataKey="income"
                                    data={chartData.map(d => ({...d, balance: d.income - d.expense}))}
                                    name="Saldo Líquido"
                                    stroke="#3b82f6"
                                    fillOpacity={1}
                                    fill="url(#colorBalance)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
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
