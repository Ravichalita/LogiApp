import { View, Text, FlatList, ActivityIndicator, Modal, TouchableOpacity, Alert, TextInput, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState, useMemo } from "react";
import { getFirebase } from "../../lib/firebase";
import { getTrucks } from "../../lib/data";
import { createTruckAction, updateTruckAction, deleteTruckAction, updateTruckStatusAction } from "../../lib/actions";
import { Truck } from "../../lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Stack, useRouter } from "expo-router";
import { ArrowLeft, Plus, X, Edit, Trash2, MoreVertical, Wrench, Truck as TruckIcon } from "lucide-react-native";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";

type TruckFormData = {
    name: string;
    plate: string;
    type: string;
    year: string;
};

const initialFormData: TruckFormData = {
    name: '',
    plate: '',
    type: '',
    year: '',
};

export default function FleetList() {
    const [trucks, setTrucks] = useState<Truck[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("");
    const [accountId, setAccountId] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editingTruck, setEditingTruck] = useState<Truck | null>(null);
    const [formData, setFormData] = useState<TruckFormData>(initialFormData);
    const [saving, setSaving] = useState(false);
    const [showActionMenu, setShowActionMenu] = useState<string | null>(null);

    const { auth, db } = getFirebase();
    const router = useRouter();

    useEffect(() => {
        const fetchTrucks = async () => {
            if (!auth.currentUser) return;
            const { doc, getDoc } = require("firebase/firestore");
            const userSnap = await getDoc(doc(db, "users", auth.currentUser.uid));

            if (userSnap.exists()) {
                const accId = userSnap.data().accountId;
                setAccountId(accId);
                return getTrucks(accId, (data) => {
                    setTrucks(data);
                    setLoading(false);
                });
            }
            setLoading(false);
            return () => { };
        };

        let unsubscribe: any;
        fetchTrucks().then(unsub => { unsubscribe = unsub; });
        return () => { if (unsubscribe) unsubscribe(); };
    }, []);

    const filteredTrucks = useMemo(() => {
        if (!filter) return trucks;
        const lower = filter.toLowerCase();
        return trucks.filter(t =>
            t.name.toLowerCase().includes(lower) ||
            t.plate.toLowerCase().includes(lower)
        );
    }, [trucks, filter]);

    const openCreateModal = () => {
        setEditingTruck(null);
        setFormData(initialFormData);
        setShowModal(true);
    };

    const openEditModal = (truck: Truck) => {
        setEditingTruck(truck);
        setFormData({
            name: truck.name,
            plate: truck.plate,
            type: truck.type || '',
            year: truck.year ? String(truck.year) : '',
        });
        setShowModal(true);
        setShowActionMenu(null);
    };

    const handleSave = async () => {
        if (!accountId || !formData.name.trim() || !formData.plate.trim()) {
            Alert.alert("Erro", "Preencha todos os campos obrigatórios.");
            return;
        }

        setSaving(true);
        try {
            const data = {
                name: formData.name.trim(),
                plate: formData.plate.trim().toUpperCase(),
                type: formData.type.trim() || undefined,
                year: formData.year ? Number(formData.year) : undefined,
            };

            let result;
            if (editingTruck) {
                result = await updateTruckAction(accountId, editingTruck.id, data);
            } else {
                result = await createTruckAction(accountId, data);
            }

            if (result.success) {
                Alert.alert("Sucesso", editingTruck ? "Veículo atualizado!" : "Veículo criado!");
                setShowModal(false);
                setFormData(initialFormData);
            } else {
                Alert.alert("Erro", result.error || "Falha ao salvar.");
            }
        } catch (error) {
            Alert.alert("Erro", "Ocorreu um erro ao salvar.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (truck: Truck) => {
        setShowActionMenu(null);
        Alert.alert(
            "Excluir Veículo",
            `Tem certeza que deseja excluir "${truck.name}"? Esta ação não pode ser desfeita.`,
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Excluir",
                    style: "destructive",
                    onPress: async () => {
                        if (!accountId) return;
                        const result = await deleteTruckAction(accountId, truck.id);
                        if (result.success) {
                            Alert.alert("Sucesso", "Veículo excluído!");
                        } else {
                            Alert.alert("Erro", result.error || "Falha ao excluir.");
                        }
                    }
                }
            ]
        );
    };

    const handleStatusToggle = async (truck: Truck) => {
        if (!accountId) return;
        setShowActionMenu(null);
        const newStatus = truck.status === 'Disponível' ? 'Em Manutenção' : 'Disponível';
        const result = await updateTruckStatusAction(accountId, truck.id, newStatus);
        if (!result.success) {
            Alert.alert("Erro", result.error || "Falha ao atualizar status.");
        }
    };

    const renderTruck = ({ item }: { item: Truck }) => (
        <Card className="mb-4 mx-4">
            <CardHeader className="pb-2 flex-row justify-between items-start">
                <View className="flex-row items-center flex-1">
                    <View className="w-10 h-10 bg-primary/10 rounded-full items-center justify-center mr-3">
                        <TruckIcon size={20} className="text-primary" />
                    </View>
                    <View className="flex-1">
                        <CardTitle className="text-lg">{item.name}</CardTitle>
                        <Text className="text-gray-500 text-sm font-semibold">{item.plate}</Text>
                    </View>
                </View>
                <View className="flex-row items-center gap-2">
                    <Badge variant={item.status === 'Disponível' ? 'success' : 'secondary'}>
                        <Text className={item.status === 'Disponível' ? 'text-primary-foreground' : 'text-secondary-foreground'}>
                            {item.status}
                        </Text>
                    </Badge>
                    <TouchableOpacity
                        onPress={() => setShowActionMenu(showActionMenu === item.id ? null : item.id)}
                        className="p-1"
                    >
                        <MoreVertical size={20} className="text-muted-foreground" />
                    </TouchableOpacity>
                </View>
            </CardHeader>

            {showActionMenu === item.id && (
                <View className="absolute right-4 top-14 bg-popover border border-border rounded-lg shadow-lg z-10 min-w-[150px]">
                    <TouchableOpacity
                        onPress={() => openEditModal(item)}
                        className="flex-row items-center px-4 py-3 border-b border-border"
                    >
                        <Edit size={16} className="text-foreground" />
                        <Text className="ml-3 text-foreground">Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => handleStatusToggle(item)}
                        className="flex-row items-center px-4 py-3 border-b border-border"
                    >
                        <Wrench size={16} className="text-foreground" />
                        <Text className="ml-3 text-foreground">
                            {item.status === 'Disponível' ? 'Manutenção' : 'Disponível'}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => handleDelete(item)}
                        className="flex-row items-center px-4 py-3"
                    >
                        <Trash2 size={16} color="#DC2626" />
                        <Text className="ml-3 text-red-600">Excluir</Text>
                    </TouchableOpacity>
                </View>
            )}

            <CardContent>
                <View className="flex-row gap-4 mt-2">
                    <View>
                        <Text className="text-xs text-muted-foreground uppercase">Tipo</Text>
                        <Text className="text-foreground font-medium">{item.type || 'Padrão'}</Text>
                    </View>
                    {item.year && (
                        <View>
                            <Text className="text-xs text-gray-400 uppercase">Ano</Text>
                            <Text className="text-gray-700 font-medium">{item.year}</Text>
                        </View>
                    )}
                </View>
            </CardContent>
        </Card>
    );

    return (
        <SafeAreaView className="flex-1 bg-background">
            <Stack.Screen options={{ headerShown: false }} />

            <View className="px-4 py-3 bg-card border-b border-border">
                <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center">
                        <TouchableOpacity onPress={() => router.back()} className="mr-3">
                            <ArrowLeft size={24} className="text-foreground" />
                        </TouchableOpacity>
                        <Text className="text-lg font-bold text-foreground">Frota</Text>
                    </View>
                    <TouchableOpacity
                        onPress={openCreateModal}
                        className="bg-orange-500 px-3 py-2 rounded-lg flex-row items-center"
                    >
                        <Plus size={18} color="#FFFFFF" />
                        <Text className="text-white font-semibold ml-1">Novo</Text>
                    </TouchableOpacity>
                </View>
                <Input
                    placeholder="Buscar veículo..."
                    value={filter}
                    onChangeText={setFilter}
                    className="h-10"
                />
            </View>

            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#FF9500" />
                </View>
            ) : (
                <FlatList
                    data={filteredTrucks}
                    keyExtractor={item => item.id}
                    renderItem={renderTruck}
                    contentContainerClassName="py-4"
                    ListEmptyComponent={
                        <View className="items-center justify-center p-8">
                            <Text className="text-gray-500">Nenhum veículo encontrado.</Text>
                        </View>
                    }
                />
            )}

            {/* Create/Edit Modal */}
            <Modal
                visible={showModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowModal(false)}
            >
                <TouchableOpacity
                    className="flex-1 bg-black/50 justify-end"
                    activeOpacity={1}
                    onPress={() => setShowModal(false)}
                >
                    <TouchableOpacity activeOpacity={1} onPress={() => { }}>
                        <View className="bg-white rounded-t-3xl p-6 pb-10">
                            <View className="flex-row items-center justify-between mb-6">
                                <Text className="text-xl font-bold text-gray-900">
                                    {editingTruck ? 'Editar Veículo' : 'Novo Veículo'}
                                </Text>
                                <TouchableOpacity onPress={() => setShowModal(false)} className="p-2 bg-gray-100 rounded-full">
                                    <X size={20} color="#6B7280" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View className="mb-4">
                                    <Text className="text-sm font-medium text-gray-700 mb-1">Nome *</Text>
                                    <TextInput
                                        placeholder="Ex: Caminhão Vácuo 01"
                                        value={formData.name}
                                        onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                                        className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-900"
                                    />
                                </View>

                                <View className="mb-4">
                                    <Text className="text-sm font-medium text-gray-700 mb-1">Placa *</Text>
                                    <TextInput
                                        placeholder="Ex: ABC-1234"
                                        value={formData.plate}
                                        onChangeText={(text) => setFormData(prev => ({ ...prev, plate: text.toUpperCase() }))}
                                        autoCapitalize="characters"
                                        className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-900"
                                    />
                                </View>

                                <View className="mb-4">
                                    <Text className="text-sm font-medium text-gray-700 mb-1">Tipo</Text>
                                    <TextInput
                                        placeholder="Ex: Roll-on, Poliguindaste"
                                        value={formData.type}
                                        onChangeText={(text) => setFormData(prev => ({ ...prev, type: text }))}
                                        className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-900"
                                    />
                                </View>

                                <View className="mb-6">
                                    <Text className="text-sm font-medium text-gray-700 mb-1">Ano</Text>
                                    <TextInput
                                        placeholder="Ex: 2023"
                                        value={formData.year}
                                        onChangeText={(text) => setFormData(prev => ({ ...prev, year: text }))}
                                        keyboardType="numeric"
                                        className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-900"
                                    />
                                </View>

                                <TouchableOpacity
                                    onPress={handleSave}
                                    disabled={saving}
                                    className={`py-4 rounded-lg items-center ${saving ? 'bg-gray-300' : 'bg-orange-500'}`}
                                >
                                    {saving ? (
                                        <ActivityIndicator color="#FFFFFF" />
                                    ) : (
                                        <Text className="text-white font-bold text-lg">
                                            {editingTruck ? 'Salvar Alterações' : 'Criar Veículo'}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
}
