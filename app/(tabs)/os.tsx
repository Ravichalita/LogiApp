import { View, Text, ActivityIndicator, FlatList, TouchableOpacity, Modal, Alert, ScrollView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState, useMemo, useCallback } from "react";
import { getFirebase } from "../../lib/firebase";
import { getPopulatedRentals, getPopulatedOperations } from "../../lib/data";
import { startRentalAction, finishRentalAction, startOperationAction, finishOperationAction } from "../../lib/actions";
import { PopulatedRental, PopulatedOperation } from "../../lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { useRouter } from "expo-router";
import { Calendar, MapPin, Search, Filter, Plus, Container, Truck, X, Play, CheckCircle } from "lucide-react-native";
import { onAuthStateChanged } from "firebase/auth";
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ServiceOrders() {
    const [rentals, setRentals] = useState<PopulatedRental[]>([]);
    const [operations, setOperations] = useState<PopulatedOperation[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [user, setUser] = useState<any>(null);
    const [accountId, setAccountId] = useState<string | null>(null);
    const [showNewOSModal, setShowNewOSModal] = useState(false);

    // Filters
    const [typeFilter, setTypeFilter] = useState<'Todas' | 'Aluguel' | 'Operação'>('Todas');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'active' | 'completed'>('all');
    const [dateFilter, setDateFilter] = useState<Date | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);

    const router = useRouter();

    const { auth, db } = getFirebase();

    useEffect(() => {
        const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
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
        const unsubRentals = getPopulatedRentals(
            accountId,
            (data) => setRentals(data),
            (err) => console.error(err)
        );
        const unsubOps = getPopulatedOperations(
            accountId,
            (data) => setOperations(data),
            (err) => console.error(err)
        );

        setLoading(false);
        return () => {
            unsubRentals();
            unsubOps();
        };
    }, [accountId]);


    const filteredItems = useMemo(() => {
        const rentalItems = rentals.map(r => ({ ...r, itemType: 'rental' as const, sortDate: r.rentalDate }));
        const opItems = operations.map(o => ({ ...o, itemType: 'operation' as const, sortDate: o.startDate! }));

        let allItems = [...rentalItems, ...opItems];

        // Type Filter
        if (typeFilter === 'Aluguel') {
            allItems = allItems.filter(i => i.itemType === 'rental');
        } else if (typeFilter === 'Operação') {
            allItems = allItems.filter(i => i.itemType === 'operation');
        }

        // Date Filter
        if (dateFilter) {
            allItems = allItems.filter(item => {
                const itemDate = new Date(item.sortDate);
                return isSameDay(itemDate, dateFilter);
            });
        }

        // Search Filter
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            allItems = allItems.filter(item =>
                item.client?.name?.toLowerCase().includes(lower) ||
                (item.itemType === 'rental' ? `al${(item as any).sequentialId}` : `op${(item as any).sequentialId}`).includes(lower) ||
                (item.itemType === 'rental' ? (item as any).deliveryAddress : (item as any).destinationAddress)?.toLowerCase().includes(lower)
            );
        }

        // Status Filter
        if (statusFilter !== 'all') {
            allItems = allItems.filter(item => {
                const status = item.status || 'Pendente';
                switch (statusFilter) {
                    case 'pending':
                        return status === 'Pendente';
                    case 'active':
                        return status === 'Ativo' || status === 'Em Andamento';
                    case 'completed':
                        return status === 'Finalizado' || status === 'Concluído';
                    default:
                        return true;
                }
            });
        }

        return allItems.sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime());
    }, [rentals, operations, searchTerm, statusFilter, typeFilter, dateFilter]);

    const handleAction = useCallback(async (item: any, action: 'start' | 'complete') => {
        if (!accountId) return;

        const isRental = item.itemType === 'rental';
        const actionName = action === 'start' ? 'Iniciar' : 'Completar';
        const osId = isRental ? `AL${item.sequentialId}` : `OP${item.sequentialId}`;

        Alert.alert(
            `${actionName} ${osId}?`,
            isRental
                ? (action === 'start' ? 'Confirma entrega da caçamba?' : 'Confirma retirada da caçamba?')
                : (action === 'start' ? 'Confirma início da operação?' : 'Confirma conclusão da operação?'),
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: actionName,
                    onPress: async () => {
                        try {
                            let result;
                            if (isRental) {
                                result = action === 'start'
                                    ? await startRentalAction(accountId, item.id)
                                    : await finishRentalAction(accountId, item.id);
                            } else {
                                result = action === 'start'
                                    ? await startOperationAction(accountId, item.id)
                                    : await finishOperationAction(accountId, item.id);
                            }

                            if (result.success) {
                                Alert.alert('Sucesso', `${osId} atualizado com sucesso!`);
                            } else {
                                Alert.alert('Erro', result.error || 'Falha ao atualizar.');
                            }
                        } catch (error) {
                            console.error(error);
                            Alert.alert('Erro', 'Ocorreu um erro ao atualizar.');
                        }
                    }
                }
            ]
        );
    }, [accountId]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Pendente': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'Ativo':
            case 'Em Andamento': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'Finalizado':
            case 'Concluído': return 'bg-green-100 text-green-800 border-green-200';
            case 'Atrasado': return 'bg-red-100 text-red-800 border-red-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const renderItem = ({ item }: { item: any }) => {
        const isRental = item.itemType === 'rental';
        const title = item.client?.name || 'Cliente não definido';

        const subtitle = isRental
            ? (item.dumpsters || []).map((d: any) => d.name).join(', ')
            : (item.operationTypes || []).map((t: any) => t.name).join(', ');

        const osId = isRental ? `AL${item.sequentialId}` : `OP${item.sequentialId}`;
        const date = isRental ? item.rentalDate : item.startDate;
        const status = item.status || 'Pendente';

        const canStart = status === 'Pendente';
        const canComplete = status === 'Ativo' || status === 'Em Andamento';

        return (
            <TouchableOpacity
                onPress={() => router.push({ pathname: "/os/[id]", params: { id: item.id, type: isRental ? 'rental' : 'operation' } })}
                activeOpacity={0.7}
            >
                <Card className="mb-3 mx-4 shadow-sm border-gray-200 bg-white">
                    <CardHeader className="pb-3 pt-4">
                        <View className="flex-row justify-between items-start">
                            <View className="flex-1 mr-2">
                                <View className="flex-row items-center mb-1">
                                    <View className="bg-gray-100 px-2 py-0.5 rounded-md mr-2">
                                        <Text className="text-[10px] font-bold text-gray-600">{osId}</Text>
                                    </View>
                                    <View className={`px-2 py-0.5 rounded-full border ${getStatusColor(status)}`}>
                                        <Text className="text-[10px] font-semibold">{status}</Text>
                                    </View>
                                </View>
                                <Text className="text-base font-bold text-gray-900" numberOfLines={1}>{title}</Text>
                            </View>
                            {/* Icon Badge */}
                            <View className={`p-2 rounded-full ${isRental ? 'bg-orange-100' : 'bg-blue-100'}`}>
                                {isRental ? <Container size={16} color="#F97316" /> : <Truck size={16} color="#3B82F6" />}
                            </View>
                        </View>
                        {subtitle ? (
                            <Text className="text-xs text-gray-500 mt-1 font-medium" numberOfLines={1}>{subtitle}</Text>
                        ) : null}
                    </CardHeader>

                    <View className="h-[1px] bg-gray-100 mx-4" />

                    <CardContent className="pt-3 pb-4">
                        <View className="flex-col gap-2">
                            <View className="flex-row items-center">
                                <Calendar size={14} color="#6B7280" />
                                <Text className="text-gray-600 text-xs ml-2 font-medium">
                                    {format(new Date(date), "dd 'de' MMMM", { locale: ptBR })}
                                </Text>
                            </View>

                            <View className="flex-row items-start">
                                <MapPin size={14} color="#6B7280" className="mt-0.5" />
                                <Text className="text-gray-600 text-xs ml-2 flex-1 leading-4" numberOfLines={2}>
                                    {isRental ? item.deliveryAddress : item.destinationAddress}
                                </Text>
                            </View>
                        </View>

                        {/* Quick Actions */}
                        {(canStart || canComplete) && (
                            <View className="flex-row mt-4 pt-0 gap-3">
                                {canStart && (
                                    <TouchableOpacity
                                        onPress={(e) => {
                                            e.stopPropagation();
                                            handleAction(item, 'start');
                                        }}
                                        className="flex-1 flex-row items-center justify-center bg-blue-600 active:bg-blue-700 rounded-md py-2"
                                    >
                                        <Play size={12} color="#FFFFFF" />
                                        <Text className="text-white text-xs font-bold ml-1.5 uppercase tracking-wide">
                                            {isRental ? 'Entregar' : 'Iniciar'}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                                {canComplete && (
                                    <TouchableOpacity
                                        onPress={(e) => {
                                            e.stopPropagation();
                                            handleAction(item, 'complete');
                                        }}
                                        className="flex-1 flex-row items-center justify-center bg-green-600 active:bg-green-700 rounded-md py-2"
                                    >
                                        <CheckCircle size={12} color="#FFFFFF" />
                                        <Text className="text-white text-xs font-bold ml-1.5 uppercase tracking-wide">
                                            {isRental ? 'Retirar' : 'Concluir'}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                    </CardContent>
                </Card>
            </TouchableOpacity>
        );
    };

    if (!accountId && !loading) {
        return (
            <SafeAreaView className="flex-1 items-center justify-center bg-gray-50">
                <Text className="text-gray-500">Carregando perfil...</Text>
            </SafeAreaView>
        )
    }

    const activeFiltersCount = (searchTerm ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0) + (dateFilter ? 1 : 0) + (typeFilter !== 'Todas' ? 1 : 0);

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            {/* Header Area */}
            <View className="bg-white border-b border-gray-200 pb-2">
                <View className="px-4 py-3">
                    <Text className="text-xl font-bold text-gray-900">Ordens de Serviço</Text>
                </View>

                {/* Search Bar */}
                <View className="px-4 mb-3">
                    <View className="flex-row items-center bg-gray-100 rounded-lg px-3 h-10 border border-gray-200">
                        <Search size={18} color="#9CA3AF" />
                        <Input
                            placeholder="Buscar OS, cliente, endereço..."
                            className="flex-1 border-0 bg-transparent h-full ml-2 text-sm"
                            value={searchTerm}
                            onChangeText={setSearchTerm}
                        />
                        {searchTerm.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchTerm('')}>
                                <X size={16} color="#9CA3AF" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Type Filters (Segmented Control style) */}
                <View className="px-4 mb-3">
                    <View className="flex-row bg-gray-100 p-1 rounded-lg">
                        {(['Todas', 'Aluguel', 'Operação'] as const).map((type) => (
                            <TouchableOpacity
                                key={type}
                                className={`flex-1 py-1.5 items-center rounded-md ${typeFilter === type ? 'bg-white shadow-sm' : ''}`}
                                onPress={() => setTypeFilter(type)}
                            >
                                <Text className={`text-xs font-semibold ${typeFilter === type ? 'text-gray-900' : 'text-gray-500'}`}>
                                    {type}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Secondary Filters (Date & Status) */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className="pl-4 pb-1"
                    contentContainerStyle={{ paddingRight: 16, gap: 8 }}
                >
                    {/* Date Filter Button */}
                    <TouchableOpacity
                        onPress={() => setShowDatePicker(true)}
                        className={`flex-row items-center px-3 py-1.5 rounded-full border ${dateFilter ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-300'}`}
                    >
                        <Calendar size={14} color={dateFilter ? "#F97316" : "#4B5563"} />
                        <Text className={`ml-1.5 text-xs font-medium ${dateFilter ? 'text-orange-700' : 'text-gray-700'}`}>
                            {dateFilter ? format(dateFilter, "dd/MM") : "Data"}
                        </Text>
                        {dateFilter && (
                            <TouchableOpacity
                                onPress={(e) => { e.stopPropagation(); setDateFilter(null); }}
                                className="ml-1.5 bg-orange-200 rounded-full p-0.5"
                            >
                                <X size={10} color="#C2410C" />
                            </TouchableOpacity>
                        )}
                    </TouchableOpacity>

                    {/* Status Chips */}
                    <TouchableOpacity
                        onPress={() => setStatusFilter(statusFilter === 'all' ? 'active' : 'all')}
                        className={`px-3 py-1.5 rounded-full border ${statusFilter !== 'all' ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-300'}`}
                    >
                        <Text className={`text-xs font-medium ${statusFilter !== 'all' ? 'text-blue-700' : 'text-gray-700'}`}>
                            {statusFilter === 'all' ? 'Status: Todos' :
                                statusFilter === 'pending' ? 'Status: Pendentes' :
                                    statusFilter === 'active' ? 'Status: Ativos' : 'Status: Finalizados'}
                        </Text>
                    </TouchableOpacity>

                    {/* Reset all */}
                    {activeFiltersCount > 0 && (
                        <TouchableOpacity
                            onPress={() => {
                                setSearchTerm('');
                                setStatusFilter('all');
                                setDateFilter(null);
                                setTypeFilter('Todas');
                            }}
                            className="px-3 py-1.5"
                        >
                            <Text className="text-xs text-red-500 font-medium">Limpar filtros</Text>
                        </TouchableOpacity>
                    )}
                </ScrollView>
            </View>

            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#FF9500" />
                </View>
            ) : (
                <FlatList
                    data={filteredItems}
                    keyExtractor={(item) => `${item.itemType}-${item.id}`}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingVertical: 12, paddingBottom: 100 }}
                    ListEmptyComponent={
                        <View className="items-center justify-center p-8 mt-10">
                            <Filter size={48} color="#E5E7EB" className="mb-4" />
                            <Text className="text-gray-500 font-medium text-center">
                                Nenhuma ordem de serviço encontrada com os filtros atuais.
                            </Text>
                        </View>
                    }
                />
            )}

            {/* FAB for creating new OS */}
            <TouchableOpacity
                onPress={() => setShowNewOSModal(true)}
                className="absolute bottom-6 right-6 w-14 h-14 bg-orange-500 rounded-full items-center justify-center shadow-lg shadow-orange-500/30"
                style={{ elevation: 5 }}
            >
                <Plus size={28} color="#FFFFFF" />
            </TouchableOpacity>

            {/* New OS Type Selection Modal */}
            <Modal
                visible={showNewOSModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowNewOSModal(false)}
            >
                <TouchableOpacity
                    className="flex-1 bg-black/50 justify-end"
                    activeOpacity={1}
                    onPress={() => setShowNewOSModal(false)}
                >
                    <View className="bg-white rounded-t-3xl p-6 pb-10">
                        <View className="flex-row items-center justify-between mb-6">
                            <Text className="text-xl font-bold text-gray-900">Nova Ordem de Serviço</Text>
                            <TouchableOpacity onPress={() => setShowNewOSModal(false)} className="p-2 bg-gray-100 rounded-full">
                                <X size={20} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            onPress={() => {
                                setShowNewOSModal(false);
                                router.push('/rentals/new');
                            }}
                            className="flex-row items-center p-4 bg-orange-50 rounded-xl mb-4 border border-orange-100 active:bg-orange-100"
                        >
                            <View className="w-12 h-12 bg-orange-500 rounded-full items-center justify-center mr-4 shadow-sm">
                                <Container size={24} color="#FFFFFF" />
                            </View>
                            <View className="flex-1">
                                <Text className="font-bold text-gray-900 text-lg">Aluguel de Caçamba</Text>
                                <Text className="text-gray-500 text-sm mt-0.5">Entrega, troca e retirada</Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => {
                                setShowNewOSModal(false);
                                router.push('/operations/new');
                            }}
                            className="flex-row items-center p-4 bg-blue-50 rounded-xl border border-blue-100 active:bg-blue-100"
                        >
                            <View className="w-12 h-12 bg-blue-500 rounded-full items-center justify-center mr-4 shadow-sm">
                                <Truck size={24} color="#FFFFFF" />
                            </View>
                            <View className="flex-1">
                                <Text className="font-bold text-gray-900 text-lg">Operação / Limpa Fossa</Text>
                                <Text className="text-gray-500 text-sm mt-0.5">Serviços de caminhão vácuo</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Date Picker */}
            {showDatePicker && (
                <DateTimePicker
                    value={dateFilter || new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedDate) => {
                        setShowDatePicker(false);
                        if (selectedDate) {
                            setDateFilter(selectedDate);
                        }
                    }}
                />
            )}
        </SafeAreaView>
    );
}
