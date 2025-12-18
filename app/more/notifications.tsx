import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import {
    Bell,
    AlertTriangle,
    Clock,
    CheckCircle,
    Calendar,
    Container,
    Truck,
    ChevronRight,
    ArrowLeft
} from 'lucide-react-native';
import { doc, getDoc, collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { format, differenceInDays, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { getFirebase } from '../../lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';

interface Notification {
    id: string;
    type: 'overdue' | 'today' | 'reminder';
    title: string;
    message: string;
    osId: string;
    osType: 'rental' | 'operation';
    date: Date;
    priority: 'high' | 'medium' | 'low';
}

// Helper to parse Firestore dates
const parseFirestoreDate = (date: any): Date => {
    if (!date) return new Date();
    if (date instanceof Timestamp) return date.toDate();
    if (date.toDate && typeof date.toDate === 'function') return date.toDate();
    if (date.seconds) return new Date(date.seconds * 1000);
    if (typeof date === 'string') return new Date(date);
    if (date instanceof Date) return date;
    return new Date();
};

export default function NotificationsScreen() {
    const router = useRouter();
    const { auth, db } = getFirebase();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [accountId, setAccountId] = useState<string>('');

    const loadNotifications = async (isRefresh = false) => {
        if (!auth.currentUser) return;

        try {
            if (isRefresh) setRefreshing(true);

            const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
            if (!userDoc.exists()) return;

            const accId = userDoc.data().accountId;
            setAccountId(accId);

            const notifs: Notification[] = [];
            const today = new Date();

            // Check rentals
            const rentalsSnap = await getDocs(collection(db, `accounts/${accId}/rentals`));
            rentalsSnap.docs.forEach(docSnap => {
                const data = docSnap.data();
                const status = data.status || 'Pendente';

                // Skip completed
                if (status === 'Finalizado' || status === 'Concluído') return;

                const rentalDate = parseFirestoreDate(data.rentalDate);
                const returnDate = data.returnDate ? parseFirestoreDate(data.returnDate) : null;

                // Check for overdue (active rentals past return date)
                if (status === 'Ativo' && returnDate && isPast(returnDate) && !isToday(returnDate)) {
                    const daysOverdue = differenceInDays(today, returnDate);
                    notifs.push({
                        id: `rental-overdue-${docSnap.id}`,
                        type: 'overdue',
                        title: `AL${data.sequentialId} - Atrasado`,
                        message: `Caçamba deveria ter sido retirada há ${daysOverdue} dia${daysOverdue > 1 ? 's' : ''}`,
                        osId: docSnap.id,
                        osType: 'rental',
                        date: returnDate,
                        priority: 'high'
                    });
                }

                // Check for pending rentals scheduled for today
                if (status === 'Pendente' && isToday(rentalDate)) {
                    notifs.push({
                        id: `rental-today-${docSnap.id}`,
                        type: 'today',
                        title: `AL${data.sequentialId} - Agendado para Hoje`,
                        message: `Entrega de caçamba para ${data.client?.name || 'Cliente'}`,
                        osId: docSnap.id,
                        osType: 'rental',
                        date: rentalDate,
                        priority: 'medium'
                    });
                }

                // Check for pending rentals that are overdue (not delivered yet)
                if (status === 'Pendente' && isPast(rentalDate) && !isToday(rentalDate)) {
                    const daysOverdue = differenceInDays(today, rentalDate);
                    notifs.push({
                        id: `rental-pending-overdue-${docSnap.id}`,
                        type: 'overdue',
                        title: `AL${data.sequentialId} - Entrega Atrasada`,
                        message: `Entrega prevista há ${daysOverdue} dia${daysOverdue > 1 ? 's' : ''}`,
                        osId: docSnap.id,
                        osType: 'rental',
                        date: rentalDate,
                        priority: 'high'
                    });
                }
            });

            // Check operations
            const operationsSnap = await getDocs(collection(db, `accounts/${accId}/operations`));
            operationsSnap.docs.forEach(docSnap => {
                const data = docSnap.data();
                const status = data.status || 'Pendente';

                // Skip completed
                if (status === 'Finalizado' || status === 'Concluído') return;

                const startDate = parseFirestoreDate(data.startDate);

                // Check for pending operations scheduled for today
                if (status === 'Pendente' && isToday(startDate)) {
                    notifs.push({
                        id: `op-today-${docSnap.id}`,
                        type: 'today',
                        title: `OP${data.sequentialId} - Agendado para Hoje`,
                        message: `Operação para ${data.client?.name || 'Cliente'}`,
                        osId: docSnap.id,
                        osType: 'operation',
                        date: startDate,
                        priority: 'medium'
                    });
                }

                // Check for pending operations that are overdue
                if (status === 'Pendente' && isPast(startDate) && !isToday(startDate)) {
                    const daysOverdue = differenceInDays(today, startDate);
                    notifs.push({
                        id: `op-pending-overdue-${docSnap.id}`,
                        type: 'overdue',
                        title: `OP${data.sequentialId} - Operação Atrasada`,
                        message: `Agendada há ${daysOverdue} dia${daysOverdue > 1 ? 's' : ''}`,
                        osId: docSnap.id,
                        osType: 'operation',
                        date: startDate,
                        priority: 'high'
                    });
                }
            });

            // Sort by priority then date
            notifs.sort((a, b) => {
                const priorityOrder = { high: 0, medium: 1, low: 2 };
                if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                    return priorityOrder[a.priority] - priorityOrder[b.priority];
                }
                return a.date.getTime() - b.date.getTime();
            });

            setNotifications(notifs);

        } catch (error) {
            console.error('Error loading notifications:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadNotifications();
    }, []);

    const onRefresh = () => loadNotifications(true);

    const getNotificationIcon = (type: string, osType: string) => {
        if (type === 'overdue') {
            return <AlertTriangle size={20} color="#DC2626" />;
        } else if (type === 'today') {
            return <Calendar size={20} color="#F59E0B" />;
        }
        return osType === 'rental' ?
            <Container size={20} color="#FF9500" /> :
            <Truck size={20} color="#3B82F6" />;
    };

    const getNotificationStyle = (type: string) => {
        switch (type) {
            case 'overdue':
                return { bg: 'bg-red-50', border: 'border-red-200', icon: 'bg-red-100' };
            case 'today':
                return { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: 'bg-yellow-100' };
            default:
                return { bg: 'bg-gray-50', border: 'border-gray-200', icon: 'bg-gray-100' };
        }
    };

    const overdueCount = notifications.filter(n => n.type === 'overdue').length;
    const todayCount = notifications.filter(n => n.type === 'today').length;

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
                <ActivityIndicator size="large" color="#FF9500" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-gray-50" edges={['bottom']}>
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Notificações',
                    headerLeft: () => (
                        <TouchableOpacity onPress={() => router.back()} className="mr-2">
                            <ArrowLeft size={24} color="#171717" />
                        </TouchableOpacity>
                    ),
                }}
            />

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
                {/* Summary Cards */}
                <View className="flex-row gap-4 mb-6">
                    <Card className={`flex-1 ${overdueCount > 0 ? 'bg-red-50 border-red-200' : ''}`}>
                        <CardContent className="pt-4 pb-4 items-center">
                            <AlertTriangle size={24} color={overdueCount > 0 ? '#DC2626' : '#9CA3AF'} />
                            <Text className={`text-2xl font-bold mt-2 ${overdueCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                {overdueCount}
                            </Text>
                            <Text className={`text-xs ${overdueCount > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                Atrasados
                            </Text>
                        </CardContent>
                    </Card>
                    <Card className={`flex-1 ${todayCount > 0 ? 'bg-yellow-50 border-yellow-200' : ''}`}>
                        <CardContent className="pt-4 pb-4 items-center">
                            <Calendar size={24} color={todayCount > 0 ? '#F59E0B' : '#9CA3AF'} />
                            <Text className={`text-2xl font-bold mt-2 ${todayCount > 0 ? 'text-yellow-600' : 'text-gray-400'}`}>
                                {todayCount}
                            </Text>
                            <Text className={`text-xs ${todayCount > 0 ? 'text-yellow-600' : 'text-gray-500'}`}>
                                Para Hoje
                            </Text>
                        </CardContent>
                    </Card>
                </View>

                {/* Notifications List */}
                {notifications.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 items-center">
                            <CheckCircle size={48} color="#16A34A" />
                            <Text className="text-gray-900 font-semibold mt-4 text-lg">
                                Tudo em dia!
                            </Text>
                            <Text className="text-gray-500 text-center mt-2">
                                Não há notificações pendentes.{'\n'}Continue assim! 🎉
                            </Text>
                        </CardContent>
                    </Card>
                ) : (
                    <View>
                        <Text className="text-gray-500 text-xs font-semibold uppercase mb-3 ml-1">
                            {notifications.length} Notificação{notifications.length > 1 ? 'ões' : ''}
                        </Text>

                        {notifications.map((notif, index) => {
                            const style = getNotificationStyle(notif.type);

                            return (
                                <TouchableOpacity
                                    key={notif.id}
                                    onPress={() => router.push({
                                        pathname: '/os/[id]',
                                        params: { id: notif.osId, type: notif.osType }
                                    })}
                                    className={`mb-3 rounded-xl p-4 ${style.bg} border ${style.border}`}
                                >
                                    <View className="flex-row items-start">
                                        <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${style.icon}`}>
                                            {getNotificationIcon(notif.type, notif.osType)}
                                        </View>
                                        <View className="flex-1">
                                            <Text className="font-semibold text-gray-900">
                                                {notif.title}
                                            </Text>
                                            <Text className="text-gray-600 text-sm mt-1">
                                                {notif.message}
                                            </Text>
                                            <Text className="text-gray-400 text-xs mt-2">
                                                {format(notif.date, "dd 'de' MMMM", { locale: ptBR })}
                                            </Text>
                                        </View>
                                        <ChevronRight size={20} color="#9CA3AF" />
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
