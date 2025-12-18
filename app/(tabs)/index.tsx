import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "../../components/ui/card";
import { getFirebase } from "../../lib/firebase";
import { useRouter } from "expo-router";
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import {
    Container,
    Truck,
    Users,
    AlertTriangle,
    Plus,
    ChevronRight,
    Calendar,
    Clock,
    TrendingUp
} from 'lucide-react-native';
import { format, isAfter, isBefore, startOfDay, endOfDay, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DashboardStats {
    activeRentals: number;
    activeOperations: number;
    pendingRentals: number;
    pendingOperations: number;
    overdueCount: number;
    totalClients: number;
    todayScheduled: number;
    recentActivities: RecentActivity[];
}

interface RecentActivity {
    id: string;
    type: 'rental' | 'operation';
    action: string;
    clientName: string;
    date: Date;
    sequentialId: number;
}

export default function Dashboard() {
    const { auth, db } = getFirebase();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState<DashboardStats>({
        activeRentals: 0,
        activeOperations: 0,
        pendingRentals: 0,
        pendingOperations: 0,
        overdueCount: 0,
        totalClients: 0,
        todayScheduled: 0,
        recentActivities: []
    });
    const [userName, setUserName] = useState('Usuário');
    const [accountId, setAccountId] = useState<string>('');

    const loadData = async (isRefresh = false) => {
        if (!auth.currentUser) return;

        try {
            if (isRefresh) setRefreshing(true);

            // Get account ID
            const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
            if (!userDoc.exists()) return;

            const accId = userDoc.data().accountId;
            setAccountId(accId);

            // Get user name (try multiple sources)
            let foundName = '';
            const teamDoc = await getDoc(doc(db, `accounts/${accId}/team`, auth.currentUser.uid));
            if (teamDoc.exists()) {
                foundName = teamDoc.data().name || '';
            }
            if (!foundName && userDoc.data().name) {
                foundName = userDoc.data().name;
            }
            if (!foundName && auth.currentUser.displayName) {
                foundName = auth.currentUser.displayName;
            }
            setUserName(foundName || 'Usuário');

            // Fetch rentals
            const rentalsSnap = await getDocs(collection(db, `accounts/${accId}/rentals`));
            let activeRentals = 0;
            let pendingRentals = 0;
            let overdueRentals = 0;
            let todayRentals = 0;
            const today = new Date();
            const todayStart = startOfDay(today);
            const todayEnd = endOfDay(today);

            const activities: RecentActivity[] = [];

            rentalsSnap.docs.forEach(doc => {
                const data = doc.data();
                const status = data.status || 'Pendente';

                if (status === 'Ativo') activeRentals++;
                if (status === 'Pendente') pendingRentals++;
                if (status === 'Atrasado') overdueRentals++;

                // Check if scheduled for today
                const rentalDate = data.rentalDate ? new Date(data.rentalDate) : null;
                if (rentalDate && rentalDate >= todayStart && rentalDate <= todayEnd && status === 'Pendente') {
                    todayRentals++;
                }

                // Add to recent activities (last 7 days)
                const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
                if (createdAt > subDays(today, 7)) {
                    activities.push({
                        id: doc.id,
                        type: 'rental',
                        action: 'Novo aluguel',
                        clientName: 'Cliente',
                        date: createdAt,
                        sequentialId: data.sequentialId
                    });
                }
            });

            // Fetch operations
            const operationsSnap = await getDocs(collection(db, `accounts/${accId}/operations`));
            let activeOperations = 0;
            let pendingOperations = 0;
            let overdueOperations = 0;
            let todayOperations = 0;

            operationsSnap.docs.forEach(doc => {
                const data = doc.data();
                const status = data.status || 'Pendente';

                if (status === 'Em Andamento') activeOperations++;
                if (status === 'Pendente') pendingOperations++;

                // Check if scheduled for today
                const startDate = data.startDate ? new Date(data.startDate) : null;
                if (startDate && startDate >= todayStart && startDate <= todayEnd && status === 'Pendente') {
                    todayOperations++;
                }

                // Add to recent activities
                const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
                if (createdAt > subDays(today, 7)) {
                    activities.push({
                        id: doc.id,
                        type: 'operation',
                        action: 'Nova operação',
                        clientName: 'Cliente',
                        date: createdAt,
                        sequentialId: data.sequentialId
                    });
                }
            });

            // Fetch clients count
            const clientsSnap = await getDocs(collection(db, `accounts/${accId}/clients`));
            const totalClients = clientsSnap.size;

            // Sort activities by date
            activities.sort((a, b) => b.date.getTime() - a.date.getTime());

            setStats({
                activeRentals,
                activeOperations,
                pendingRentals,
                pendingOperations,
                overdueCount: overdueRentals + overdueOperations,
                totalClients,
                todayScheduled: todayRentals + todayOperations,
                recentActivities: activities.slice(0, 5)
            });

        } catch (error) {
            console.error('Error loading dashboard:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const onRefresh = () => loadData(true);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Bom dia';
        if (hour < 18) return 'Boa tarde';
        return 'Boa noite';
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
                <ActivityIndicator size="large" color="#FF9500" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <ScrollView
                className="flex-1"
                contentContainerStyle={{ padding: 16 }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={['#FF9500']}
                        tintColor="#FF9500"
                    />
                }
            >
                {/* Header */}
                <View className="mb-6">
                    <Text className="text-gray-500 text-sm">{getGreeting()},</Text>
                    <Text className="text-2xl font-bold text-gray-900">{userName}</Text>
                </View>

                {/* Main Stats */}
                <View className="flex-row gap-3 mb-4">
                    <TouchableOpacity
                        className="flex-1"
                        onPress={() => router.push('/(tabs)/os')}
                    >
                        <Card className="bg-orange-500 border-0">
                            <CardContent className="pt-4 pb-4">
                                <View className="flex-row items-center justify-between">
                                    <View>
                                        <Text className="text-orange-100 text-xs uppercase font-medium">Aluguéis Ativos</Text>
                                        <Text className="text-white text-3xl font-bold">{stats.activeRentals}</Text>
                                    </View>
                                    <Container size={32} color="rgba(255,255,255,0.3)" />
                                </View>
                            </CardContent>
                        </Card>
                    </TouchableOpacity>
                    <TouchableOpacity
                        className="flex-1"
                        onPress={() => router.push('/(tabs)/os')}
                    >
                        <Card className="bg-blue-500 border-0">
                            <CardContent className="pt-4 pb-4">
                                <View className="flex-row items-center justify-between">
                                    <View>
                                        <Text className="text-blue-100 text-xs uppercase font-medium">Operações</Text>
                                        <Text className="text-white text-3xl font-bold">{stats.activeOperations}</Text>
                                    </View>
                                    <Truck size={32} color="rgba(255,255,255,0.3)" />
                                </View>
                            </CardContent>
                        </Card>
                    </TouchableOpacity>
                </View>

                {/* Secondary Stats */}
                <View className="flex-row gap-3 mb-6">
                    <Card className="flex-1">
                        <CardContent className="pt-3 pb-3 items-center">
                            <View className="flex-row items-center">
                                <Clock size={16} color="#F59E0B" />
                                <Text className="text-lg font-bold text-gray-900 ml-2">
                                    {stats.pendingRentals + stats.pendingOperations}
                                </Text>
                            </View>
                            <Text className="text-xs text-gray-500">Pendentes</Text>
                        </CardContent>
                    </Card>
                    <Card className="flex-1">
                        <CardContent className="pt-3 pb-3 items-center">
                            <View className="flex-row items-center">
                                <Calendar size={16} color="#10B981" />
                                <Text className="text-lg font-bold text-gray-900 ml-2">{stats.todayScheduled}</Text>
                            </View>
                            <Text className="text-xs text-gray-500">Para Hoje</Text>
                        </CardContent>
                    </Card>
                    <Card className="flex-1">
                        <CardContent className="pt-3 pb-3 items-center">
                            <View className="flex-row items-center">
                                <Users size={16} color="#6366F1" />
                                <Text className="text-lg font-bold text-gray-900 ml-2">{stats.totalClients}</Text>
                            </View>
                            <Text className="text-xs text-gray-500">Clientes</Text>
                        </CardContent>
                    </Card>
                </View>

                {/* Overdue Alert */}
                {stats.overdueCount > 0 && (
                    <TouchableOpacity onPress={() => router.push('/(tabs)/os')}>
                        <Card className="mb-4 bg-red-50 border-red-200">
                            <CardContent className="pt-4 pb-4 flex-row items-center">
                                <View className="w-10 h-10 bg-red-100 rounded-full items-center justify-center mr-3">
                                    <AlertTriangle size={20} color="#DC2626" />
                                </View>
                                <View className="flex-1">
                                    <Text className="font-semibold text-red-900">Atenção!</Text>
                                    <Text className="text-red-700 text-sm">
                                        {stats.overdueCount} OS {stats.overdueCount === 1 ? 'está atrasada' : 'estão atrasadas'}
                                    </Text>
                                </View>
                                <ChevronRight size={20} color="#DC2626" />
                            </CardContent>
                        </Card>
                    </TouchableOpacity>
                )}

                {/* Quick Actions */}
                <Card className="mb-4">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Ações Rápidas</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <View className="flex-row gap-3">
                            <TouchableOpacity
                                className="flex-1 bg-orange-500 rounded-xl py-4 items-center"
                                onPress={() => router.push('/rentals/new')}
                            >
                                <Plus size={24} color="#FFFFFF" />
                                <Text className="text-white font-medium mt-1">Novo Aluguel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="flex-1 bg-blue-500 rounded-xl py-4 items-center"
                                onPress={() => router.push('/operations/new')}
                            >
                                <Plus size={24} color="#FFFFFF" />
                                <Text className="text-white font-medium mt-1">Nova Operação</Text>
                            </TouchableOpacity>
                        </View>
                    </CardContent>
                </Card>

                {/* Recent Activities */}
                <Card className="mb-4">
                    <CardHeader className="pb-2">
                        <View className="flex-row items-center justify-between">
                            <CardTitle className="text-base">Atividades Recentes</CardTitle>
                            <TouchableOpacity onPress={() => router.push('/(tabs)/os')}>
                                <Text className="text-orange-500 text-sm">Ver todas</Text>
                            </TouchableOpacity>
                        </View>
                    </CardHeader>
                    <CardContent>
                        {stats.recentActivities.length === 0 ? (
                            <View className="items-center py-6">
                                <TrendingUp size={32} color="#D1D5DB" />
                                <Text className="text-gray-500 mt-2">Nenhuma atividade recente</Text>
                            </View>
                        ) : (
                            <View>
                                {stats.recentActivities.map((activity, index) => (
                                    <TouchableOpacity
                                        key={activity.id}
                                        onPress={() => router.push({
                                            pathname: '/os/[id]',
                                            params: { id: activity.id, type: activity.type }
                                        })}
                                        className={`flex-row items-center py-3 ${index < stats.recentActivities.length - 1 ? 'border-b border-gray-100' : ''
                                            }`}
                                    >
                                        <View className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${activity.type === 'rental' ? 'bg-orange-100' : 'bg-blue-100'
                                            }`}>
                                            {activity.type === 'rental' ? (
                                                <Container size={14} color="#FF9500" />
                                            ) : (
                                                <Truck size={14} color="#3B82F6" />
                                            )}
                                        </View>
                                        <View className="flex-1">
                                            <Text className="font-medium text-gray-900">
                                                {activity.type === 'rental' ? `AL${activity.sequentialId}` : `OP${activity.sequentialId}`}
                                            </Text>
                                            <Text className="text-xs text-gray-500">{activity.action}</Text>
                                        </View>
                                        <Text className="text-xs text-gray-400">
                                            {format(activity.date, 'dd/MM', { locale: ptBR })}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </CardContent>
                </Card>

            </ScrollView>
        </SafeAreaView>
    );
}
