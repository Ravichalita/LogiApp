import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Alert, Linking, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getFirebase } from '../../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { Client, Rental, Operation } from '../../lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import {
    MapPin,
    Mail,
    Phone,
    ArrowLeft,
    Star,
    Plus,
    MessageCircle,
    Edit,
    Calendar,
    Container,
    Truck,
    FileText,
    DollarSign
} from 'lucide-react-native';
import { differenceInDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Helper to safely parse Firestore dates (handles Timestamp and ISO strings)
const parseFirestoreDate = (date: any): Date => {
    if (!date) return new Date();
    if (date instanceof Timestamp) return date.toDate();
    if (date instanceof Timestamp) return date.toDate();
    if (date.toDate && typeof date.toDate === 'function') return date.toDate();
    if (date.seconds) return new Date(date.seconds * 1000);
    if (typeof date === 'string') return new Date(date);
    if (date instanceof Date) return date;
    return new Date();
};

interface OSItem {
    id: string;
    type: 'rental' | 'operation';
    sequentialId: number;
    date: string;
    status: string;
    value: number;
    description: string;
}

export default function ClientDetail() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const [client, setClient] = useState<Client | null>(null);
    const [osHistory, setOsHistory] = useState<OSItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [accountId, setAccountId] = useState<string>('');
    const router = useRouter();
    const { auth, db } = getFirebase();

    useEffect(() => {
        const fetchClient = async () => {
            if (!auth.currentUser || !id) return;

            try {
                const userSnap = await getDoc(doc(db, "users", auth.currentUser.uid));
                if (!userSnap.exists()) return;
                const accId = userSnap.data().accountId;
                setAccountId(accId);

                const docRef = doc(db, `accounts/${accId}/clients`, id);
                const docSnap = await getDoc(docRef);

                if (!docSnap.exists()) {
                    Alert.alert("Erro", "Cliente não encontrado");
                    router.back();
                    return;
                }

                setClient({ id: docSnap.id, ...docSnap.data() } as Client);

                // Load OS history
                await loadOSHistory(accId, id);

            } catch (error) {
                console.error(error);
                Alert.alert("Erro", "Falha ao carregar cliente");
            } finally {
                setLoading(false);
            }
        };

        fetchClient();
    }, [id]);

    const loadOSHistory = async (accId: string, clientId: string) => {
        try {
            const items: OSItem[] = [];

            // Fetch rentals for this client
            const rentalsQuery = query(
                collection(db, `accounts/${accId}/rentals`),
                where('clientId', '==', clientId)
            );
            const rentalsSnap = await getDocs(rentalsQuery);
            rentalsSnap.docs.forEach(doc => {
                const data = doc.data();
                items.push({
                    id: doc.id,
                    type: 'rental',
                    sequentialId: data.sequentialId,
                    date: parseFirestoreDate(data.rentalDate).toISOString(),
                    status: data.status || 'Pendente',
                    value: data.value || 0,
                    description: `Aluguel de caçamba`
                });
            });

            // Fetch operations for this client
            const operationsQuery = query(
                collection(db, `accounts/${accId}/operations`),
                where('clientId', '==', clientId)
            );
            const operationsSnap = await getDocs(operationsQuery);
            operationsSnap.docs.forEach(doc => {
                const data = doc.data();
                items.push({
                    id: doc.id,
                    type: 'operation',
                    sequentialId: data.sequentialId,
                    date: parseFirestoreDate(data.startDate).toISOString(),
                    status: data.status || 'Pendente',
                    value: data.value || 0,
                    description: `Operação`
                });
            });

            // Sort by date descending
            items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setOsHistory(items);

        } catch (error) {
            console.error('Error loading OS history:', error);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleCall = (phone: string) => {
        Linking.openURL(`tel:${phone}`);
    };

    const handleWhatsApp = (phone: string) => {
        const numbers = phone.replace(/\D/g, '');
        Linking.openURL(`https://wa.me/55${numbers}`);
    };

    const handleOpenMap = (address: string) => {
        if (!address) return;
        const url = Platform.select({
            ios: `maps:0,0?q=${address}`,
            android: `geo:0,0?q=${address}`,
        });
        if (url) Linking.openURL(url);
    };

    const handleNewOS = () => {
        // Navigate to new rental with pre-selected client
        router.push({
            pathname: '/rentals/new',
            params: { clientId: id }
        });
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Pendente': return { bg: 'bg-yellow-100', text: 'text-yellow-800' };
            case 'Ativo':
            case 'Em Andamento': return { bg: 'bg-blue-100', text: 'text-blue-800' };
            case 'Finalizado':
            case 'Concluído': return { bg: 'bg-green-100', text: 'text-green-800' };
            default: return { bg: 'bg-gray-100', text: 'text-gray-800' };
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(value);
    };

    // Calculate totals
    const totalOS = osHistory.length;
    const totalValue = osHistory.reduce((sum, os) => sum + os.value, 0);

    if (loading) {
        return (
            <SafeAreaView className="flex-1 items-center justify-center bg-gray-50">
                <ActivityIndicator size="large" color="#FF9500" />
            </SafeAreaView>
        );
    }

    if (!client) return null;

    const isNew = client.createdAt ? differenceInDays(new Date(), parseFirestoreDate(client.createdAt)) <= 3 : false;

    return (
        <SafeAreaView className="flex-1 bg-gray-50" edges={['bottom']}>
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Detalhes do Cliente',
                    headerLeft: () => (
                        <TouchableOpacity onPress={() => router.back()} className="mr-2">
                            <ArrowLeft size={24} color="#171717" />
                        </TouchableOpacity>
                    ),
                    headerRight: () => (
                        <TouchableOpacity
                            onPress={() => router.push({
                                pathname: '/clients/edit',
                                params: { id }
                            })}
                            className="ml-2"
                        >
                            <Edit size={20} color="#FF9500" />
                        </TouchableOpacity>
                    ),
                }}
            />

            <ScrollView className="flex-1">
                {/* Client Card */}
                <View className="p-4">
                    <Card className="bg-white">
                        <CardHeader className="pb-2">
                            <View className="flex-row justify-between items-start">
                                <View className="flex-1">
                                    <View className="flex-row items-center">
                                        <CardTitle className="text-xl">{client.name}</CardTitle>
                                        {isNew && (
                                            <View className="ml-2 bg-yellow-400 px-2 py-0.5 rounded-full flex-row items-center">
                                                <Star size={10} color="white" fill="white" />
                                                <Text className="text-white text-[10px] ml-1">Novo</Text>
                                            </View>
                                        )}
                                    </View>
                                    {client.cpfCnpj && (
                                        <Text className="text-gray-500 text-sm mt-1">{client.cpfCnpj}</Text>
                                    )}
                                </View>
                            </View>
                        </CardHeader>
                        <CardContent>
                            {/* Contact Info */}
                            <View className="space-y-3">
                                {client.phone && (
                                    <View className="flex-row items-center">
                                        <Phone size={18} color="#6B7280" />
                                        <Text className="text-gray-700 ml-2 flex-1">{client.phone}</Text>
                                    </View>
                                )}
                                {client.email && (
                                    <View className="flex-row items-center">
                                        <Mail size={18} color="#6B7280" />
                                        <Text className="text-gray-700 ml-2 flex-1">{client.email}</Text>
                                    </View>
                                )}
                                {client.address && (
                                    <View className="flex-row items-center">
                                        <MapPin size={18} color="#6B7280" />
                                        <Text className="text-gray-700 ml-2 flex-1">{client.address}</Text>
                                        <TouchableOpacity onPress={() => handleOpenMap(client.address!)}>
                                            <Text className="text-blue-500 font-semibold text-xs ml-2">Mapa</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>

                            {/* Quick Actions */}
                            {client.phone && (
                                <View className="flex-row gap-2 mt-4 pt-4 border-t border-gray-100">
                                    <TouchableOpacity
                                        onPress={() => handleCall(client.phone!)}
                                        className="flex-1 bg-blue-500 rounded-lg py-3 flex-row items-center justify-center"
                                    >
                                        <Phone size={18} color="#FFFFFF" />
                                        <Text className="text-white font-medium ml-2">Ligar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => handleWhatsApp(client.phone!)}
                                        className="flex-1 bg-green-500 rounded-lg py-3 flex-row items-center justify-center"
                                    >
                                        <MessageCircle size={18} color="#FFFFFF" />
                                        <Text className="text-white font-medium ml-2">WhatsApp</Text>
                                    </TouchableOpacity>
                                    {client.address && (
                                        <TouchableOpacity
                                            onPress={() => handleOpenMap(client.address!)}
                                            className="w-12 bg-orange-100 rounded-lg items-center justify-center"
                                        >
                                            <MapPin size={20} color="#FF9500" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}
                        </CardContent>
                    </Card>
                </View>

                {/* Stats */}
                <View className="px-4 mb-4">
                    <View className="flex-row gap-4">
                        <Card className="flex-1">
                            <CardContent className="pt-4 pb-4 items-center">
                                <View className="w-10 h-10 bg-orange-100 rounded-full items-center justify-center mb-2">
                                    <FileText size={20} color="#FF9500" />
                                </View>
                                <Text className="text-2xl font-bold text-gray-900">{totalOS}</Text>
                                <Text className="text-xs text-gray-500">Ordens de Serviço</Text>
                            </CardContent>
                        </Card>
                        <Card className="flex-1">
                            <CardContent className="pt-4 pb-4 items-center">
                                <View className="w-10 h-10 bg-green-100 rounded-full items-center justify-center mb-2">
                                    <DollarSign size={20} color="#16A34A" />
                                </View>
                                <Text className="text-xl font-bold text-green-600">{formatCurrency(totalValue)}</Text>
                                <Text className="text-xs text-gray-500">Total</Text>
                            </CardContent>
                        </Card>
                    </View>
                </View>

                {/* OS History */}
                <View className="px-4 mb-4">
                    <View className="flex-row items-center justify-between mb-3">
                        <Text className="text-base font-semibold text-gray-900">Histórico de OS</Text>
                        <TouchableOpacity
                            onPress={handleNewOS}
                            className="flex-row items-center bg-orange-500 rounded-lg px-3 py-2"
                        >
                            <Plus size={16} color="#FFFFFF" />
                            <Text className="text-white font-medium text-sm ml-1">Nova OS</Text>
                        </TouchableOpacity>
                    </View>

                    {loadingHistory ? (
                        <ActivityIndicator size="small" color="#FF9500" />
                    ) : osHistory.length === 0 ? (
                        <Card>
                            <CardContent className="py-8 items-center">
                                <FileText size={32} color="#D1D5DB" />
                                <Text className="text-gray-500 mt-2">Nenhuma OS encontrada</Text>
                                <TouchableOpacity
                                    onPress={handleNewOS}
                                    className="mt-4 bg-orange-500 rounded-lg px-4 py-2"
                                >
                                    <Text className="text-white font-medium">Criar primeira OS</Text>
                                </TouchableOpacity>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card>
                            <CardContent className="py-0">
                                {osHistory.map((os, index) => {
                                    const statusColor = getStatusColor(os.status);
                                    const isRental = os.type === 'rental';
                                    const osCode = isRental ? `AL${os.sequentialId}` : `OP${os.sequentialId}`;

                                    return (
                                        <TouchableOpacity
                                            key={os.id}
                                            onPress={() => router.push({
                                                pathname: '/os/[id]',
                                                params: { id: os.id, type: os.type }
                                            })}
                                            className={`flex-row items-center py-4 ${index < osHistory.length - 1 ? 'border-b border-gray-100' : ''
                                                }`}
                                        >
                                            <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${isRental ? 'bg-orange-100' : 'bg-blue-100'
                                                }`}>
                                                {isRental ? (
                                                    <Container size={18} color="#FF9500" />
                                                ) : (
                                                    <Truck size={18} color="#3B82F6" />
                                                )}
                                            </View>
                                            <View className="flex-1">
                                                <View className="flex-row items-center">
                                                    <Text className="font-semibold text-gray-900">{osCode}</Text>
                                                    <View className={`ml-2 px-2 py-0.5 rounded-full ${statusColor.bg}`}>
                                                        <Text className={`text-xs ${statusColor.text}`}>{os.status}</Text>
                                                    </View>
                                                </View>
                                                <View className="flex-row items-center mt-1">
                                                    <Calendar size={12} color="#9CA3AF" />
                                                    <Text className="text-gray-500 text-xs ml-1">
                                                        {format(new Date(os.date), 'dd/MM/yyyy', { locale: ptBR })}
                                                    </Text>
                                                </View>
                                            </View>
                                            <Text className="font-semibold text-gray-900">
                                                {formatCurrency(os.value)}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    )}
                </View>

                {/* Observations */}
                {client.observations && (
                    <View className="px-4 mb-4">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">Observações</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Text className="text-gray-600 italic">{client.observations}</Text>
                            </CardContent>
                        </Card>
                    </View>
                )}

                <View className="h-8" />
            </ScrollView>
        </SafeAreaView>
    );
}
