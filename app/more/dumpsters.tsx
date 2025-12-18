import { View, Text, FlatList, ActivityIndicator, Modal, TouchableOpacity, Alert, TextInput, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState, useMemo, useCallback } from "react";
import { getFirebase } from "../../lib/firebase";
import { getDumpsters } from "../../lib/data";
import { createDumpsterAction, updateDumpsterAction, deleteDumpsterAction, updateDumpsterStatusAction } from "../../lib/actions";
import { Dumpster, DUMPSTER_COLORS, DumpsterColor } from "../../lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Stack, useRouter } from "expo-router";
import { ArrowLeft, Plus, X, Edit, Trash2, MoreVertical, Wrench } from "lucide-react-native";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";

type DumpsterFormData = {
    name: string;
    size: string;
    color: DumpsterColor;
};

const initialFormData: DumpsterFormData = {
    name: '',
    size: '',
    color: 'Amarelo',
};

const colorOptions = Object.keys(DUMPSTER_COLORS) as DumpsterColor[];

export default function DumpstersList() {
    const [dumpsters, setDumpsters] = useState<Dumpster[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("");
    const [accountId, setAccountId] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editingDumpster, setEditingDumpster] = useState<Dumpster | null>(null);
    const [formData, setFormData] = useState<DumpsterFormData>(initialFormData);
    const [saving, setSaving] = useState(false);
    const [showActionMenu, setShowActionMenu] = useState<string | null>(null);

    const { auth, db } = getFirebase();
    const router = useRouter();

    useEffect(() => {
        const fetchDumpsters = async () => {
            if (!auth.currentUser) return;
            const { doc, getDoc } = require("firebase/firestore");
            const userSnap = await getDoc(doc(db, "users", auth.currentUser.uid));

            if (userSnap.exists()) {
                const accId = userSnap.data().accountId;
                setAccountId(accId);
                return getDumpsters(accId, (data) => {
                    setDumpsters(data);
                    setLoading(false);
                });
            }
            setLoading(false);
            return () => { };
        };

        let unsubscribe: any;
        fetchDumpsters().then(unsub => { unsubscribe = unsub; });
        return () => { if (unsubscribe) unsubscribe(); };
    }, []);

    const filteredDumpsters = useMemo(() => {
        if (!filter) return dumpsters;
        return dumpsters.filter(d => d.name.toLowerCase().includes(filter.toLowerCase()));
    }, [dumpsters, filter]);

    const openCreateModal = () => {
        setEditingDumpster(null);
        setFormData(initialFormData);
        setShowModal(true);
    };

    const openEditModal = (dumpster: Dumpster) => {
        setEditingDumpster(dumpster);
        setFormData({
            name: dumpster.name,
            size: String(dumpster.size),
            color: dumpster.color as DumpsterColor,
        });
        setShowModal(true);
        setShowActionMenu(null);
    };

    const handleSave = async () => {
        if (!accountId || !formData.name.trim() || !formData.size.trim()) {
            Alert.alert("Erro", "Preencha todos os campos obrigatórios.");
            return;
        }

        setSaving(true);
        try {
            const data = {
                name: formData.name.trim(),
                size: Number(formData.size),
                color: formData.color,
            };

            let result;
            if (editingDumpster) {
                result = await updateDumpsterAction(accountId, editingDumpster.id, data);
            } else {
                result = await createDumpsterAction(accountId, data);
            }

            if (result.success) {
                Alert.alert("Sucesso", editingDumpster ? "Caçamba atualizada!" : "Caçamba criada!");
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

    const handleDelete = (dumpster: Dumpster) => {
        setShowActionMenu(null);
        Alert.alert(
            "Excluir Caçamba",
            `Tem certeza que deseja excluir "${dumpster.name}"? Esta ação não pode ser desfeita.`,
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Excluir",
                    style: "destructive",
                    onPress: async () => {
                        if (!accountId) return;
                        const result = await deleteDumpsterAction(accountId, dumpster.id);
                        if (result.success) {
                            Alert.alert("Sucesso", "Caçamba excluída!");
                        } else {
                            Alert.alert("Erro", result.error || "Falha ao excluir.");
                        }
                    }
                }
            ]
        );
    };

    const handleStatusToggle = async (dumpster: Dumpster) => {
        if (!accountId) return;
        setShowActionMenu(null);
        const newStatus = dumpster.status === 'Disponível' ? 'Em Manutenção' : 'Disponível';
        const result = await updateDumpsterStatusAction(accountId, dumpster.id, newStatus);
        if (!result.success) {
            Alert.alert("Erro", result.error || "Falha ao atualizar status.");
        }
    };

    const renderDumpster = ({ item }: { item: Dumpster }) => {
        const colorInfo = DUMPSTER_COLORS[item.color] || { value: '#9CA3AF', description: 'Desconhecido' };

        return (
            <Card className="mb-4 mx-4">
                <CardHeader className="pb-2 flex-row justify-between items-start">
                    <View className="flex-row items-center flex-1">
                        <View className="w-4 h-4 rounded-full mr-3 border border-gray-200" style={{ backgroundColor: colorInfo.value }} />
                        <CardTitle className="text-lg">{item.name}</CardTitle>
                    </View>
                    <View className="flex-row items-center gap-2">
                        <Badge variant={item.status === 'Disponível' ? 'success' : 'secondary'}>
                            <Text className={item.status === 'Disponível' ? 'text-green-800' : 'text-gray-600'}>
                                {item.status}
                            </Text>
                        </Badge>
                        <TouchableOpacity
                            onPress={() => setShowActionMenu(showActionMenu === item.id ? null : item.id)}
                            className="p-1"
                        >
                            <MoreVertical size={20} color="#6B7280" />
                        </TouchableOpacity>
                    </View>
                </CardHeader>

                {showActionMenu === item.id && (
                    <View className="absolute right-4 top-14 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[150px]">
                        <TouchableOpacity
                            onPress={() => openEditModal(item)}
                            className="flex-row items-center px-4 py-3 border-b border-gray-100"
                        >
                            <Edit size={16} color="#4B5563" />
                            <Text className="ml-3 text-gray-700">Editar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => handleStatusToggle(item)}
                            className="flex-row items-center px-4 py-3 border-b border-gray-100"
                        >
                            <Wrench size={16} color="#4B5563" />
                            <Text className="ml-3 text-gray-700">
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
                    <View className="flex-row justify-between items-center mt-1">
                        <View>
                            <Text className="text-xs text-gray-400 uppercase">Tamanho</Text>
                            <Text className="text-gray-700 font-medium">{item.size}m³</Text>
                        </View>
                        <View className="flex-1 ml-6">
                            <Text className="text-xs text-gray-400 uppercase">Tipo de Resíduo</Text>
                            <Text className="text-gray-700 font-medium" numberOfLines={1}>{colorInfo.description}</Text>
                        </View>
                    </View>
                </CardContent>
            </Card>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <Stack.Screen options={{ headerShown: false }} />

            <View className="px-4 py-3 bg-white border-b border-gray-200">
                <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center">
                        <TouchableOpacity onPress={() => router.back()} className="mr-3">
                            <ArrowLeft size={24} color="#1F2937" />
                        </TouchableOpacity>
                        <Text className="text-lg font-bold text-gray-900">Caçambas</Text>
                    </View>
                    <TouchableOpacity
                        onPress={openCreateModal}
                        className="bg-orange-500 px-3 py-2 rounded-lg flex-row items-center"
                    >
                        <Plus size={18} color="#FFFFFF" />
                        <Text className="text-white font-semibold ml-1">Nova</Text>
                    </TouchableOpacity>
                </View>
                <Input
                    placeholder="Buscar caçamba..."
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
                    data={filteredDumpsters}
                    keyExtractor={item => item.id}
                    renderItem={renderDumpster}
                    contentContainerClassName="py-4"
                    ListEmptyComponent={
                        <View className="items-center justify-center p-8">
                            <Text className="text-gray-500">Nenhuma caçamba encontrada.</Text>
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
                                    {editingDumpster ? 'Editar Caçamba' : 'Nova Caçamba'}
                                </Text>
                                <TouchableOpacity onPress={() => setShowModal(false)} className="p-2 bg-gray-100 rounded-full">
                                    <X size={20} color="#6B7280" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View className="mb-4">
                                    <Text className="text-sm font-medium text-gray-700 mb-1">Nome *</Text>
                                    <TextInput
                                        placeholder="Ex: Caçamba 01"
                                        value={formData.name}
                                        onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                                        className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-900"
                                    />
                                </View>

                                <View className="mb-4">
                                    <Text className="text-sm font-medium text-gray-700 mb-1">Tamanho (m³) *</Text>
                                    <TextInput
                                        placeholder="Ex: 5"
                                        value={formData.size}
                                        onChangeText={(text) => setFormData(prev => ({ ...prev, size: text }))}
                                        keyboardType="numeric"
                                        className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-900"
                                    />
                                </View>

                                <View className="mb-6">
                                    <Text className="text-sm font-medium text-gray-700 mb-2">Cor / Tipo de Resíduo</Text>
                                    <View className="flex-row flex-wrap gap-2">
                                        {colorOptions.map((color) => {
                                            const info = DUMPSTER_COLORS[color];
                                            const isSelected = formData.color === color;
                                            return (
                                                <TouchableOpacity
                                                    key={color}
                                                    onPress={() => setFormData(prev => ({ ...prev, color }))}
                                                    className={`flex-row items-center px-3 py-2 rounded-full border ${isSelected ? 'bg-orange-50 border-orange-300' : 'bg-gray-50 border-gray-200'}`}
                                                >
                                                    <View
                                                        className="w-4 h-4 rounded-full mr-2 border border-gray-300"
                                                        style={{ backgroundColor: info.value }}
                                                    />
                                                    <Text className={`text-sm ${isSelected ? 'text-orange-700 font-medium' : 'text-gray-600'}`}>
                                                        {color}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
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
                                            {editingDumpster ? 'Salvar Alterações' : 'Criar Caçamba'}
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
