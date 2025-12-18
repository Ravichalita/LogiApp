import React, { useEffect, useState, useMemo } from 'react';
import {
    View,
    Text,
    ScrollView,
    ActivityIndicator,
    TouchableOpacity,
    FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { ChevronLeft, TrendingUp, TrendingDown, DollarSign, Calendar, ChevronRight, ArrowUpCircle, ArrowDownCircle } from 'lucide-react-native';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { getFirebase } from '../../lib/firebase';
import { getTransactions } from '../../lib/data';
import { Transaction } from '../../lib/types';

export default function FinanceScreen() {
    const router = useRouter();
    const { auth } = getFirebase();

    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [accountId, setAccountId] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState(new Date());

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
    const { totalIncome, totalExpense, balance } = useMemo(() => {
        let income = 0;
        let expense = 0;

        transactions.forEach(t => {
            if (t.type === 'income') {
                income += t.amount;
            } else {
                expense += t.amount;
            }
        });

        return {
            totalIncome: income,
            totalExpense: expense,
            balance: income - expense
        };
    }, [transactions]);

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

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'paid': return 'text-green-600';
            case 'pending': return 'text-yellow-600';
            case 'overdue': return 'text-red-600';
            case 'cancelled': return 'text-gray-400';
            default: return 'text-gray-600';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'paid': return 'Pago';
            case 'pending': return 'Pendente';
            case 'overdue': return 'Atrasado';
            case 'cancelled': return 'Cancelado';
            default: return status;
        }
    };

    const renderTransaction = ({ item }: { item: Transaction }) => {
        const isIncome = item.type === 'income';

        return (
            <TouchableOpacity className="flex-row items-center py-4 border-b border-gray-100">
                <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${isIncome ? 'bg-green-100' : 'bg-red-100'
                    }`}>
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
                    <View className="flex-row items-center">
                        <Text className="text-xs text-gray-500">
                            {format(new Date(item.dueDate), 'dd/MM/yyyy')}
                        </Text>
                        <Text className={`text-xs ml-2 ${getStatusColor(item.status)}`}>
                            • {getStatusLabel(item.status)}
                        </Text>
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
                                                {formatCurrency(balance)}
                                            </Text>
                                        </View>
                                        <View className="w-14 h-14 bg-white/20 rounded-full items-center justify-center">
                                            <DollarSign size={28} color="#FFFFFF" />
                                        </View>
                                    </View>
                                </CardContent>
                            </Card>

                            <View className="flex-row gap-4">
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
                                            {formatCurrency(totalIncome)}
                                        </Text>
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
                                            {formatCurrency(totalExpense)}
                                        </Text>
                                    </CardContent>
                                </Card>
                            </View>
                        </View>

                        {/* Transactions List */}
                        <View className="px-4 pb-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Transações</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {transactions.length === 0 ? (
                                        <View className="py-8 items-center">
                                            <Text className="text-gray-500">Nenhuma transação neste período</Text>
                                        </View>
                                    ) : (
                                        transactions.map((item) => (
                                            <View key={item.id}>
                                                {renderTransaction({ item })}
                                            </View>
                                        ))
                                    )}
                                </CardContent>
                            </Card>
                        </View>
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
