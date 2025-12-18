import React, { useEffect, useState, useMemo } from 'react';
import {
    View,
    Text,
    ScrollView,
    ActivityIndicator,
    TouchableOpacity,
    Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { ChevronLeft, TrendingUp, TrendingDown, DollarSign, ChevronRight, ArrowUpCircle, ArrowDownCircle, Filter, Clock, CheckCircle, AlertCircle, Percent } from 'lucide-react-native';
import { format, subMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { getFirebase } from '../../lib/firebase';
import { getTransactions } from '../../lib/data';
import { Transaction } from '../../lib/types';

type StatusFilter = 'all' | 'pending' | 'paid' | 'overdue';

export default function FinanceScreen() {
    const router = useRouter();
    const { auth } = getFirebase();

    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [accountId, setAccountId] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState(new Date());
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [showFilterModal, setShowFilterModal] = useState(false);

    useEffect(() => {
        const loadAccountId = async () => {
            const user = auth.currentUser;
            if (user) {
                const token = await user.getIdTokenResult();
                setAccountId(token.claims.accountId as string || '');
            }
        };
        loadAccountId();
    }, []);

    useEffect(() => {
        if (!accountId) return;

        const loadTransactions = async () => {
            setLoading(true);
            try {
                const data = await getTransactions(
                    accountId,
                    selectedMonth.getMonth(),
                    selectedMonth.getFullYear()
                );
                setTransactions(data);
            } catch (error) {
                console.error('Error loading transactions:', error);
            } finally {
                setLoading(false);
            }
        };

        loadTransactions();
    }, [accountId, selectedMonth]);

    // Calculate totals
    const metrics = useMemo(() => {
        let totalIncome = 0;
        let totalExpense = 0;
        let pendingIncome = 0;
        let pendingExpense = 0;

        transactions.forEach(t => {
            if (t.status === 'cancelled') return;

            if (t.type === 'income') {
                totalIncome += t.amount;
                if (t.status === 'pending') pendingIncome += t.amount;
            } else {
                totalExpense += t.amount;
                if (t.status === 'pending' || t.status === 'overdue') pendingExpense += t.amount;
            }
        });

        const balance = totalIncome - totalExpense;
        const margin = totalIncome > 0 ? (balance / totalIncome) * 100 : 0;

        return { totalIncome, totalExpense, balance, pendingIncome, pendingExpense, margin };
    }, [transactions]);

    // Filter transactions
    const filteredTransactions = useMemo(() => {
        if (statusFilter === 'all') return transactions;
        return transactions.filter(t => t.status === statusFilter);
    }, [transactions, statusFilter]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(value);
    };

    const handlePreviousMonth = () => {
        setSelectedMonth(prev => subMonths(prev, 1));
    };

    const handleNextMonth = () => {
        setSelectedMonth(prev => addMonths(prev, 1));
    };

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'paid': return { color: 'text-green-600', bg: 'bg-green-100', label: 'Pago', icon: CheckCircle };
            case 'pending': return { color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'Pendente', icon: Clock };
            case 'overdue': return { color: 'text-red-600', bg: 'bg-red-100', label: 'Atrasado', icon: AlertCircle };
            case 'cancelled': return { color: 'text-gray-400', bg: 'bg-gray-100', label: 'Cancelado', icon: Clock };
            default: return { color: 'text-gray-600', bg: 'bg-gray-100', label: status, icon: Clock };
        }
    };

    const filterOptions: { value: StatusFilter; label: string; count: number }[] = [
        { value: 'all', label: 'Todas', count: transactions.length },
        { value: 'pending', label: 'Pendentes', count: transactions.filter(t => t.status === 'pending').length },
        { value: 'paid', label: 'Pagas', count: transactions.filter(t => t.status === 'paid').length },
        { value: 'overdue', label: 'Atrasadas', count: transactions.filter(t => t.status === 'overdue').length },
    ];

    const renderTransaction = (item: Transaction) => {
        const isIncome = item.type === 'income';
        const statusConfig = getStatusConfig(item.status);
        const StatusIcon = statusConfig.icon;

        return (
            <TouchableOpacity key={item.id} className="flex-row items-center py-4 border-b border-gray-100">
                <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${isIncome ? 'bg-green-100' : 'bg-red-100'}`}>
                    {isIncome ? (
                        <ArrowUpCircle size={20} color="#16A34A" />
                    ) : (
                        <ArrowDownCircle size={20} color="#DC2626" />
                    )}
                </View>

                <View className="flex-1">
                    <Text className="font-medium text-gray-900" numberOfLines={1}>
                        {item.description}
                    </Text>
                    <View className="flex-row items-center mt-1">
                        <Text className="text-xs text-gray-500">
                            {format(new Date(item.dueDate), 'dd/MM/yyyy')}
                        </Text>
                        <View className={`flex-row items-center ml-2 px-2 py-0.5 rounded-full ${statusConfig.bg}`}>
                            <StatusIcon size={10} color={statusConfig.color.replace('text-', '#').replace('-600', '')} />
                            <Text className={`text-xs ml-1 ${statusConfig.color}`}>
                                {statusConfig.label}
                            </Text>
                        </View>
                    </View>
                </View>

                <Text className={`font-semibold ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
                    {isIncome ? '+' : '-'}{formatCurrency(item.amount)}
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50" edges={['bottom']}>
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Financeiro',
                    headerLeft: () => (
                        <TouchableOpacity onPress={() => router.back()} className="mr-2">
                            <ChevronLeft size={24} color="#171717" />
                        </TouchableOpacity>
                    ),
                }}
            />

            <ScrollView className="flex-1">
                {/* Month Selector */}
                <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
                    <TouchableOpacity onPress={handlePreviousMonth} className="p-2">
                        <ChevronLeft size={24} color="#FF9500" />
                    </TouchableOpacity>
                    <Text className="text-lg font-semibold text-gray-900">
                        {format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}
                    </Text>
                    <TouchableOpacity onPress={handleNextMonth} className="p-2">
                        <ChevronRight size={24} color="#FF9500" />
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View className="flex-1 items-center justify-center py-20">
                        <ActivityIndicator size="large" color="#FF9500" />
                    </View>
                ) : (
                    <>
                        {/* Summary Cards */}
                        <View className="p-4">
                            {/* Balance Card */}
                            <Card className="mb-4 bg-orange-500">
                                <CardContent className="pt-6">
                                    <View className="flex-row items-center justify-between">
                                        <View>
                                            <Text className="text-orange-100 text-sm">Saldo do Período</Text>
                                            <Text className="text-white text-3xl font-bold mt-1">
                                                {formatCurrency(metrics.balance)}
                                            </Text>
                                        </View>
                                        <View className="w-14 h-14 bg-white/20 rounded-full items-center justify-center">
                                            <DollarSign size={28} color="#FFFFFF" />
                                        </View>
                                    </View>
                                </CardContent>
                            </Card>

                            <View className="flex-row gap-4 mb-4">
                                {/* Income Card */}
                                <Card className="flex-1">
                                    <CardContent className="pt-4 pb-4">
                                        <View className="flex-row items-center mb-2">
                                            <View className="w-8 h-8 bg-green-100 rounded-full items-center justify-center mr-2">
                                                <TrendingUp size={16} color="#16A34A" />
                                            </View>
                                            <Text className="text-gray-500 text-sm">Receitas</Text>
                                        </View>
                                        <Text className="text-green-600 text-xl font-bold">
                                            {formatCurrency(metrics.totalIncome)}
                                        </Text>
                                        {metrics.pendingIncome > 0 && (
                                            <Text className="text-xs text-gray-400 mt-1">
                                                A receber: {formatCurrency(metrics.pendingIncome)}
                                            </Text>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Expense Card */}
                                <Card className="flex-1">
                                    <CardContent className="pt-4 pb-4">
                                        <View className="flex-row items-center mb-2">
                                            <View className="w-8 h-8 bg-red-100 rounded-full items-center justify-center mr-2">
                                                <TrendingDown size={16} color="#DC2626" />
                                            </View>
                                            <Text className="text-gray-500 text-sm">Despesas</Text>
                                        </View>
                                        <Text className="text-red-600 text-xl font-bold">
                                            {formatCurrency(metrics.totalExpense)}
                                        </Text>
                                        {metrics.pendingExpense > 0 && (
                                            <Text className="text-xs text-gray-400 mt-1">
                                                A pagar: {formatCurrency(metrics.pendingExpense)}
                                            </Text>
                                        )}
                                    </CardContent>
                                </Card>
                            </View>

                            {/* Margin Card */}
                            <Card className="mb-4">
                                <CardContent className="pt-4 pb-4 flex-row items-center justify-between">
                                    <View className="flex-row items-center">
                                        <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center mr-3">
                                            <Percent size={20} color="#3B82F6" />
                                        </View>
                                        <View>
                                            <Text className="text-gray-500 text-sm">Margem de Lucro</Text>
                                            <Text className="text-gray-400 text-xs">Saldo / Receitas</Text>
                                        </View>
                                    </View>
                                    <Text className={`text-2xl font-bold ${metrics.margin >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                        {metrics.margin.toFixed(1)}%
                                    </Text>
                                </CardContent>
                            </Card>
                        </View>

                        {/* Transactions List */}
                        <View className="px-4 pb-4">
                            <Card>
                                <CardHeader className="flex-row items-center justify-between">
                                    <CardTitle className="text-base">Transações</CardTitle>
                                    <TouchableOpacity
                                        onPress={() => setShowFilterModal(true)}
                                        className="flex-row items-center px-3 py-1.5 bg-gray-100 rounded-full"
                                    >
                                        <Filter size={14} color="#6B7280" />
                                        <Text className="text-gray-600 text-sm ml-1">
                                            {filterOptions.find(f => f.value === statusFilter)?.label}
                                        </Text>
                                    </TouchableOpacity>
                                </CardHeader>
                                <CardContent>
                                    {filteredTransactions.length === 0 ? (
                                        <View className="py-8 items-center">
                                            <Text className="text-gray-500">Nenhuma transação {statusFilter !== 'all' ? 'com este status' : 'neste período'}</Text>
                                        </View>
                                    ) : (
                                        filteredTransactions.map((item) => renderTransaction(item))
                                    )}
                                </CardContent>
                            </Card>
                        </View>
                    </>
                )}
            </ScrollView>

            {/* Filter Modal */}
            <Modal
                visible={showFilterModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowFilterModal(false)}
            >
                <TouchableOpacity
                    className="flex-1 bg-black/50 justify-end"
                    activeOpacity={1}
                    onPress={() => setShowFilterModal(false)}
                >
                    <View className="bg-white rounded-t-3xl p-6">
                        <Text className="text-lg font-bold text-gray-900 mb-4">Filtrar por Status</Text>
                        {filterOptions.map((option) => (
                            <TouchableOpacity
                                key={option.value}
                                onPress={() => {
                                    setStatusFilter(option.value);
                                    setShowFilterModal(false);
                                }}
                                className={`flex-row items-center justify-between py-4 border-b border-gray-100 ${statusFilter === option.value ? 'bg-orange-50 -mx-6 px-6' : ''}`}
                            >
                                <Text className={`font-medium ${statusFilter === option.value ? 'text-orange-600' : 'text-gray-700'}`}>
                                    {option.label}
                                </Text>
                                <Badge variant="secondary">
                                    <Text className="text-gray-600">{option.count}</Text>
                                </Badge>
                            </TouchableOpacity>
                        ))}
                        <View className="h-6" />
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
}
