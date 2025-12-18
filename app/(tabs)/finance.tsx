import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, FlatList, TouchableOpacity, RefreshControl, SafeAreaView } from 'react-native';
import { useAuth } from '../../context/auth';
import { getTransactions, getFinancialCategories, toggleTransactionStatus } from '../../lib/finance';
import { Transaction, TransactionCategory, HistoricItem } from '../../lib/types';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { format, parseISO, isAfter, startOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowUpCircle, ArrowDownCircle, Filter, Wallet, DollarSign, Calendar as CalendarIcon, ChevronLeft, ChevronRight, CheckCircle2, Clock } from 'lucide-react-native';
import { cn } from '../../lib/utils';
import { useFocusEffect } from 'expo-router';

// Utility to format currency
function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
}

const STATUS_LABELS: Record<string, string> = {
    pending: 'Pendente',
    paid: 'Pago',
    overdue: 'Vencido',
    cancelled: 'Cancelado'
};

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'> = {
    pending: 'warning',
    paid: 'success',
    overdue: 'destructive',
    cancelled: 'secondary'
};

export default function FinanceScreen() {
    const { user, userDetail } = useAuth();
    const [currentTab, setCurrentTab] = useState<'dashboard' | 'transactions'>('dashboard');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Data
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [categories, setCategories] = useState<TransactionCategory[]>([]);

    // Filters
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterType, setFilterType] = useState<string>('all');

    const accountId = userDetail?.accountId;

    const fetchData = useCallback(async () => {
        if (!accountId) return;
        setLoading(true);
        try {
            const [fetchedTransactions, fetchedCategories] = await Promise.all([
                getTransactions(accountId, {
                    month: selectedDate.getMonth(),
                    year: selectedDate.getFullYear()
                }),
                getFinancialCategories(accountId)
            ]);
            setTransactions(fetchedTransactions);
            setCategories(fetchedCategories);
        } catch (error) {
            console.error("Error fetching finance data:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [accountId, selectedDate]);

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [fetchData])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    // Dashboard Calculations
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


    // Filter Transactions
    const filteredTransactions = transactions.filter(t => {
        const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
        const matchesType = filterType === 'all' || t.type === filterType;
        const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesStatus && matchesType && matchesSearch;
    });

    const handleToggleStatus = async (transaction: Transaction) => {
        if (!accountId) return;

        // Optimistic UI update
        const newStatus = transaction.status === 'paid' ? 'pending' : 'paid';
        setTransactions(prev => prev.map(t => t.id === transaction.id ? { ...t, status: newStatus as any } : t));

        try {
            await toggleTransactionStatus(accountId, transaction.id, transaction.status);
        } catch (error) {
            console.error("Error toggling status:", error);
            // Revert on error
            setTransactions(prev => prev.map(t => t.id === transaction.id ? { ...t, status: transaction.status } : t));
        }
    };

    const renderDashboard = () => (
        <ScrollView className="flex-1 px-4 py-4 space-y-4" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
            <View className="flex-row justify-between items-center mb-2">
                <Text className="text-2xl font-bold text-foreground font-headline">Visão Geral</Text>
                <View className="flex-row items-center bg-card rounded-md border border-border">
                    <Button variant="ghost" size="icon" onPress={() => setSelectedDate(new Date(selectedDate.setMonth(selectedDate.getMonth() - 1)))}>
                        <ChevronLeft size={20} className="text-muted-foreground" />
                    </Button>
                    <Text className="px-2 font-medium text-foreground capitalize">
                        {format(selectedDate, 'MMM yyyy', { locale: ptBR })}
                    </Text>
                    <Button variant="ghost" size="icon" onPress={() => setSelectedDate(new Date(selectedDate.setMonth(selectedDate.getMonth() + 1)))}>
                        <ChevronRight size={20} className="text-muted-foreground" />
                    </Button>
                </View>
            </View>

            <View className="flex-row gap-4 mb-4">
                <Card className="flex-1 bg-card">
                    <CardHeader className="pb-2">
                        <View className="flex-row justify-between items-center">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo</CardTitle>
                            <Wallet size={16} className="text-muted-foreground" />
                        </View>
                    </CardHeader>
                    <CardContent>
                        <Text className={cn("text-2xl font-bold", balance >= 0 ? 'text-green-600' : 'text-red-600')}>
                            {formatCurrency(balance)}
                        </Text>
                        <Text className="text-xs text-muted-foreground">Receitas - Despesas</Text>
                    </CardContent>
                </Card>
            </View>

            <View className="flex-row gap-4">
                <Card className="flex-1 bg-card">
                    <CardContent className="pt-6">
                        <View className="flex-row justify-between items-center mb-2">
                            <Text className="text-sm font-medium text-muted-foreground">Receitas</Text>
                            <ArrowUpCircle size={16} className="text-green-500" />
                        </View>
                        <Text className="text-xl font-bold text-foreground">{formatCurrency(totalIncome)}</Text>
                        <Text className="text-xs text-muted-foreground mt-1">A receber: {formatCurrency(pendingIncome)}</Text>
                    </CardContent>
                </Card>
                <Card className="flex-1 bg-card">
                    <CardContent className="pt-6">
                        <View className="flex-row justify-between items-center mb-2">
                            <Text className="text-sm font-medium text-muted-foreground">Despesas</Text>
                            <ArrowDownCircle size={16} className="text-red-500" />
                        </View>
                        <Text className="text-xl font-bold text-foreground">{formatCurrency(totalExpenses)}</Text>
                        <Text className="text-xs text-muted-foreground mt-1">A pagar: {formatCurrency(pendingExpenses)}</Text>
                    </CardContent>
                </Card>
            </View>

            <Card className="mt-4 bg-card">
                <CardHeader>
                    <CardTitle>Resumo Recente</CardTitle>
                </CardHeader>
                <CardContent>
                    {transactions.slice(0, 5).map(t => (
                        <View key={t.id} className="flex-row justify-between items-center py-3 border-b border-border last:border-0">
                            <View className="flex-1 pr-4">
                                <Text className="font-medium text-foreground truncate">{t.description}</Text>
                                <Text className="text-xs text-muted-foreground">{format(parseISO(t.dueDate), 'dd/MM')}</Text>
                            </View>
                            <Text className={cn("font-bold", t.type === 'income' ? 'text-green-600' : 'text-red-600')}>
                                {t.type === 'expense' ? '-' : '+'}{formatCurrency(t.amount)}
                            </Text>
                        </View>
                    ))}
                    {transactions.length === 0 && (
                        <Text className="text-muted-foreground text-center py-4">Nenhuma transação.</Text>
                    )}
                </CardContent>
            </Card>

        </ScrollView>
    );

    const renderTransactionsList = () => (
        <View className="flex-1">
            <View className="px-4 py-2 space-y-3">
                <Input
                    placeholder="Buscar..."
                    value={searchTerm}
                    onChangeText={setSearchTerm}
                    className="bg-card"
                />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2 pb-2">
                    <Button
                        variant={filterType === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onPress={() => setFilterType('all')}
                    >
                        Todos
                    </Button>
                    <Button
                        variant={filterType === 'income' ? 'default' : 'outline'}
                        size="sm"
                        onPress={() => setFilterType('income')}
                    >
                        Entradas
                    </Button>
                    <Button
                        variant={filterType === 'expense' ? 'default' : 'outline'}
                        size="sm"
                        onPress={() => setFilterType('expense')}
                    >
                        Saídas
                    </Button>
                </ScrollView>
            </View>

            <FlatList
                data={filteredTransactions}
                keyExtractor={item => item.id}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                ListEmptyComponent={<Text className="text-center text-muted-foreground mt-10">Nenhuma transação encontrada.</Text>}
                renderItem={({ item: t }) => {
                    const isFuture = isAfter(parseISO(t.dueDate), startOfDay(new Date()));
                    const category = categories.find(c => c.id === t.categoryId);

                    return (
                        <TouchableOpacity className="mb-3">
                            <Card className={cn("bg-card border-l-4", t.type === 'income' ? 'border-l-green-500' : 'border-l-red-500')}>
                                <CardContent className="p-4">
                                    <View className="flex-row justify-between items-start mb-2">
                                        <View className="flex-1 pr-2">
                                            <Text className="font-semibold text-foreground text-lg mb-1">{t.description}</Text>
                                            <View className="flex-row gap-2 mb-1">
                                                {category && (
                                                    <Badge variant="secondary" className="mr-1">
                                                        {category.name}
                                                    </Badge>
                                                )}
                                                {isFuture && t.status === 'pending' && <Badge variant="info">Futuro</Badge>}
                                            </View>
                                        </View>
                                        <View className="items-end">
                                            <Text className={cn("text-lg font-bold", t.type === 'income' ? 'text-green-600' : 'text-red-600')}>
                                                {t.type === 'expense' ? '-' : ''}{formatCurrency(t.amount)}
                                            </Text>
                                        </View>
                                    </View>

                                    <View className="flex-row justify-between items-center pt-2 border-t border-border mt-2">
                                        <View className="flex-row items-center">
                                            <CalendarIcon size={14} className="text-muted-foreground mr-1" />
                                            <Text className="text-xs text-muted-foreground">
                                                {format(parseISO(t.dueDate), 'dd/MM/yyyy')}
                                            </Text>
                                        </View>

                                        <TouchableOpacity
                                            onPress={() => handleToggleStatus(t)}
                                            className="flex-row items-center bg-secondary/50 px-2 py-1 rounded-full"
                                        >
                                            {t.status === 'paid' ? <CheckCircle2 size={14} className="text-green-600 mr-1" /> : <Clock size={14} className="text-yellow-600 mr-1" />}
                                            <Text className={cn("text-xs font-medium", t.status === 'paid' ? 'text-green-600' : 'text-yellow-600')}>
                                                {STATUS_LABELS[t.status]}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </CardContent>
                            </Card>
                        </TouchableOpacity>
                    );
                }}
            />
        </View>
    );

    if (!accountId) {
        return (
            <SafeAreaView className="flex-1 bg-background justify-center items-center">
                <Text className="text-muted-foreground">Carregando perfil...</Text>
            </SafeAreaView>
        )
    }

    return (
        <SafeAreaView className="flex-1 bg-background pt-8">
            <View className="px-4 py-2 border-b border-border bg-card">
                <Text className="text-3xl font-bold font-headline text-foreground">Financeiro</Text>
            </View>

            <View className="flex-row px-4 py-4 gap-4">
                <Button
                    variant={currentTab === 'dashboard' ? 'default' : 'outline'}
                    className="flex-1"
                    onPress={() => setCurrentTab('dashboard')}
                >
                    Dashboard
                </Button>
                <Button
                    variant={currentTab === 'transactions' ? 'default' : 'outline'}
                    className="flex-1"
                    onPress={() => setCurrentTab('transactions')}
                >
                    Transações
                </Button>
            </View>

            {currentTab === 'dashboard' ? renderDashboard() : renderTransactionsList()}
        </SafeAreaView>
    );
}
