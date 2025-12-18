import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, Linking, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState, useMemo } from "react";
import { getFirebase } from "../../lib/firebase";
import { getClients, getPopulatedRentals, getPopulatedOperations } from "../../lib/data";
import { Client, PopulatedRental, PopulatedOperation } from "../../lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Search, Phone, MapPin, Mail, Star, Plus, MessageCircle, Container, Truck } from "lucide-react-native";
import { onAuthStateChanged } from "firebase/auth";
import { differenceInDays, parseISO, addDays } from "date-fns";
import { Badge } from "../../components/ui/badge";
import { useRouter } from "expo-router";

type FilterType = 'novos' | 'ativos' | 'concluidos' | 'todos' | 'nao_atendidos';

export default function Clients() {
    const [clients, setClients] = useState<Client[]>([]);
    const [rentals, setRentals] = useState<PopulatedRental[]>([]);
    const [operations, setOperations] = useState<PopulatedOperation[]>([]);

    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [activeFilter, setActiveFilter] = useState<FilterType>('ativos');
    const [accountId, setAccountId] = useState<string | null>(null);
    const router = useRouter();

    const { auth, db } = getFirebase();

    useEffect(() => {
        const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                const { doc, getDoc } = require("firebase/firestore");
                const userDocRef = doc(db, "users", currentUser.uid);
                const userSnap = await getDoc(userDocRef);
                if (userSnap.exists()) {
                    setAccountId(userSnap.data().accountId);
                }
            } else {
                setLoading(false);
            }
        });
        return () => unsubAuth();
    }, []);

    useEffect(() => {
        if (!accountId) return;

        setLoading(true);
        const unsubClients = getClients(accountId, (data) => setClients(data));

        // We need all rentals/ops to determine status
        // Note: For large datasets, this should be optimized to server-side counts/flags
        const unsubRentals = getPopulatedRentals(accountId, (data) => setRentals(data), console.error);
        const unsubOps = getPopulatedOperations(accountId, (data) => setOperations(data), console.error);

        // Simple way to handle loading state for multiple subs
        // In a real app we might want more granular loading, but this works
        const timeout = setTimeout(() => setLoading(false), 1000);

        return () => {
            unsubClients();
            unsubRentals();
            unsubOps();
            clearTimeout(timeout);
        };
    }, [accountId]);

    const categorizedClients = useMemo(() => {
        const today = new Date();

        // Identify Active and Completed Clients
        const activeClientIds = new Set<string>();
        const completedClientIds = new Set<string>();

        rentals.forEach(r => {
            if (!r.client) return;
            if (['Pendente', 'Aprovado', 'Entregue', 'Em Andamento', 'A Retirar'].includes(r.status)) {
                activeClientIds.add(r.client.id);
            } else if (['Finalizado', 'Concluído'].includes(r.status)) {
                completedClientIds.add(r.client.id);
            }
        });

        operations.forEach(o => {
            if (['Pendente', 'Em Andamento'].includes(o.status)) {
                activeClientIds.add(o.clientId);
            } else if (['Concluído', 'Finalizado'].includes(o.status)) {
                completedClientIds.add(o.clientId);
            }
        });

        const active: Client[] = [];
        const newC: Client[] = [];
        const completed: Client[] = [];
        const unserved: Client[] = [];
        const allFiltered: Client[] = []; // For 'todos'

        clients.forEach(client => {
            // Apply search filter first
            const matchesSearch = !searchTerm || (
                client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (client.phone && client.phone.includes(searchTerm)) ||
                (client.address && client.address.toLowerCase().includes(searchTerm.toLowerCase()))
            );

            if (!matchesSearch) return;

            allFiltered.push(client);

            const hasActiveService = activeClientIds.has(client.id);
            const hasCompletedService = completedClientIds.has(client.id);
            const creationDate = client.createdAt
                ? (typeof client.createdAt === 'string' ? parseISO(client.createdAt as any) : new Date(client.createdAt.seconds * 1000))
                : new Date(0);
            const isNew = differenceInDays(today, creationDate) <= 3;

            if (hasActiveService) {
                active.push(client);
            } else if (isNew && !hasActiveService && !hasCompletedService) {
                newC.push(client);
            } else if (!hasActiveService && hasCompletedService) {
                completed.push(client);
            } else if (!isNew && !hasActiveService && !hasCompletedService) {
                unserved.push(client);
            }
        });

        return {
            ativos: active,
            novos: newC,
            concluidos: completed,
            nao_atendidos: unserved,
            todos: allFiltered
        };
    }, [clients, rentals, operations, searchTerm]);

    const displayedClients = categorizedClients[activeFilter];

    const handleCall = (phone: string) => {
        Linking.openURL(`tel:${phone}`);
    };

    const handleWhatsApp = (phone: string) => {
        const numbers = phone.replace(/\D/g, '');
        Linking.openURL(`https://wa.me/55${numbers}`);
    };

    const renderClient = ({ item }: { item: Client }) => {
        const isNew = item.createdAt
            ? differenceInDays(new Date(), typeof item.createdAt === 'string' ? parseISO(item.createdAt as any) : new Date(item.createdAt.seconds * 1000)) <= 3
            : false;

        // Check active stats for badges
        const clientRentals = rentals.filter(r => r.client?.id === item.id && ['Pendente', 'Entregue', 'A Retirar'].includes(r.status));
        const clientOps = operations.filter(o => o.clientId === item.id && ['Pendente', 'Em Andamento'].includes(o.status));

        return (
            <TouchableOpacity onPress={() => router.push({ pathname: "/clients/[id]", params: { id: item.id } })}>
                <Card className="mb-3 mx-4">
                    <CardHeader className="pb-2">
                        <View className="flex-row justify-between items-start">
                            <CardTitle className="text-lg flex-1">{item.name}</CardTitle>
                            {isNew && (
                                <Badge variant="warning" className="ml-2">
                                    <Star size={10} color="white" fill="white" />
                                    <Text className="text-white text-[10px] ml-1">Novo</Text>
                                </Badge>
                            )}
                        </View>
                        <View className="flex-row gap-2 mt-1">
                            {clientRentals.length > 0 && (
                                <View className="flex-row items-center bg-orange-100 px-2 py-0.5 rounded-md">
                                    <Container size={10} color="#F97316" />
                                    <Text className="text-[10px] text-orange-700 ml-1">{clientRentals.length} Caçambas</Text>
                                </View>
                            )}
                            {clientOps.length > 0 && (
                                <View className="flex-row items-center bg-blue-100 px-2 py-0.5 rounded-md">
                                    <Truck size={10} color="#2563EB" />
                                    <Text className="text-[10px] text-blue-700 ml-1">{clientOps.length} Ops</Text>
                                </View>
                            )}
                        </View>
                    </CardHeader>
                    <CardContent>
                        <View className="space-y-2">
                            {item.phone && (
                                <View className="flex-row items-center">
                                    <Phone size={14} color="#6B7280" />
                                    <Text className="text-gray-600 ml-2 text-sm">{item.phone}</Text>
                                </View>
                            )}
                            {item.address && (
                                <View className="flex-row items-center">
                                    <MapPin size={14} color="#6B7280" />
                                    <Text className="text-gray-600 ml-2 text-sm flex-1 numberOfLines={1}">{item.address}</Text>
                                </View>
                            )}
                        </View>

                        {/* Quick Actions Row */}
                        <View className="flex-row gap-2 mt-3 pt-3 border-t border-gray-100">
                            {item.phone && (
                                <>
                                    <TouchableOpacity
                                        onPress={() => handleCall(item.phone!)}
                                        className="flex-1 bg-gray-50 py-2 rounded-md items-center justify-center flex-row border border-gray-200"
                                    >
                                        <Phone size={14} color="#374151" />
                                        <Text className="text-xs text-gray-700 font-medium ml-1">Ligar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => handleWhatsApp(item.phone!)}
                                        className="flex-1 bg-green-50 py-2 rounded-md items-center justify-center flex-row border border-green-200"
                                    >
                                        <MessageCircle size={14} color="#16A34A" />
                                        <Text className="text-xs text-green-700 font-medium ml-1">WhatsApp</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    </CardContent>
                </Card>
            </TouchableOpacity>
        );
    };

    if (!accountId && !loading) {
        return (
            <SafeAreaView className="flex-1 items-center justify-center">
                <Text>Carregando perfil...</Text>
            </SafeAreaView>
        )
    }

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            {/* Header / Search */}
            <View className="bg-white border-b border-gray-200">
                <View className="px-4 py-2">
                    <View className="flex-row items-center bg-gray-100 rounded-md px-3 py-2">
                        <Search size={20} color="#9CA3AF" />
                        <Input
                            placeholder="Buscar cliente..."
                            className="flex-1 border-0 bg-transparent h-8"
                            value={searchTerm}
                            onChangeText={setSearchTerm}
                        />
                    </View>
                </View>

                {/* Filters */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4, gap: 8 }}
                >
                    <TouchableOpacity
                        onPress={() => setActiveFilter('ativos')}
                        className={`px-4 py-1.5 rounded-full border ${activeFilter === 'ativos' ? 'bg-orange-500 border-orange-500' : 'bg-white border-gray-300'}`}
                    >
                        <Text className={`text-sm font-medium ${activeFilter === 'ativos' ? 'text-white' : 'text-gray-700'}`}>Ativos ({categorizedClients.ativos.length})</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setActiveFilter('novos')}
                        className={`px-4 py-1.5 rounded-full border ${activeFilter === 'novos' ? 'bg-orange-500 border-orange-500' : 'bg-white border-gray-300'}`}
                    >
                        <Text className={`text-sm font-medium ${activeFilter === 'novos' ? 'text-white' : 'text-gray-700'}`}>Novos ({categorizedClients.novos.length})</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setActiveFilter('todos')}
                        className={`px-4 py-1.5 rounded-full border ${activeFilter === 'todos' ? 'bg-orange-500 border-orange-500' : 'bg-white border-gray-300'}`}
                    >
                        <Text className={`text-sm font-medium ${activeFilter === 'todos' ? 'text-white' : 'text-gray-700'}`}>Todos</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setActiveFilter('concluidos')}
                        className={`px-4 py-1.5 rounded-full border ${activeFilter === 'concluidos' ? 'bg-orange-500 border-orange-500' : 'bg-white border-gray-300'}`}
                    >
                        <Text className={`text-sm font-medium ${activeFilter === 'concluidos' ? 'text-white' : 'text-gray-700'}`}>Concluídos</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setActiveFilter('nao_atendidos')}
                        className={`px-4 py-1.5 rounded-full border ${activeFilter === 'nao_atendidos' ? 'bg-orange-500 border-orange-500' : 'bg-white border-gray-300'}`}
                    >
                        <Text className={`text-sm font-medium ${activeFilter === 'nao_atendidos' ? 'text-white' : 'text-gray-700'}`}>Não Atendidos</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>

            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#FF9500" />
                </View>
            ) : (
                <FlatList
                    data={displayedClients}
                    keyExtractor={(item) => item.id}
                    renderItem={renderClient}
                    contentContainerStyle={{ paddingVertical: 16 }}
                    ListEmptyComponent={
                        <View className="items-center justify-center p-8">
                            <Text className="text-gray-500">Nenhum cliente encontrado.</Text>
                        </View>
                    }
                />
            )}

            {/* FAB - New Client */}
            <TouchableOpacity
                className="absolute bottom-6 right-6 w-14 h-14 bg-orange-500 rounded-full items-center justify-center shadow-lg"
                style={{ elevation: 5 }}
                onPress={() => router.push('/clients/new')}
            >
                <Plus size={28} color="#FFFFFF" />
            </TouchableOpacity>
        </SafeAreaView>
    );
}
