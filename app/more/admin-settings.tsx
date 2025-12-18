import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    ActivityIndicator,
    TouchableOpacity,
    Modal,
    TextInput,
    Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import {
    ChevronLeft,
    ChevronDown,
    ChevronUp,
    Plus,
    X,
    Trash2,
    MapPin,
    Workflow,
    Tag,
    Truck
} from 'lucide-react-native';
import { doc, getDoc } from 'firebase/firestore';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { getFirebase } from '../../lib/firebase';
import { updateOperationTypesAction, updateBasesAction, updateRentalPricesAction, updateTruckTypesAction } from '../../lib/actions';
import { Account, OperationType, Base, RentalPrice, TruckType } from '../../lib/types';

type Section = 'operation-types' | 'bases' | 'rental-prices' | 'truck-types' | null;

export default function AdminSettingsScreen() {
    const router = useRouter();
    const { auth, db } = getFirebase();

    const [loading, setLoading] = useState(true);
    const [account, setAccount] = useState<Account | null>(null);
    const [accountId, setAccountId] = useState<string>('');
    const [expandedSection, setExpandedSection] = useState<Section>(null);
    const [saving, setSaving] = useState(false);

    // Operation Types state
    const [operationTypes, setOperationTypes] = useState<OperationType[]>([]);
    const [showAddOperationType, setShowAddOperationType] = useState(false);
    const [newTypeName, setNewTypeName] = useState('');
    const [newTypeValue, setNewTypeValue] = useState('');

    // Bases state
    const [bases, setBases] = useState<Base[]>([]);
    const [showAddBase, setShowAddBase] = useState(false);
    const [newBaseName, setNewBaseName] = useState('');
    const [newBaseAddress, setNewBaseAddress] = useState('');

    // Rental prices state
    const [rentalPrices, setRentalPrices] = useState<RentalPrice[]>([]);
    const [showAddPrice, setShowAddPrice] = useState(false);
    const [newPriceName, setNewPriceName] = useState('');
    const [newPriceValue, setNewPriceValue] = useState('');

    // Truck types state
    const [truckTypes, setTruckTypes] = useState<TruckType[]>([]);
    const [showAddTruckType, setShowAddTruckType] = useState(false);
    const [newTruckTypeName, setNewTruckTypeName] = useState('');

    useEffect(() => {
        loadAccountData();
    }, []);

    const loadAccountData = async () => {
        if (!auth.currentUser) return;

        try {
            const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
            if (!userDoc.exists()) return;

            const accId = userDoc.data().accountId;
            setAccountId(accId);

            const accountDoc = await getDoc(doc(db, 'accounts', accId));
            if (accountDoc.exists()) {
                const data = accountDoc.data() as Account;
                setAccount({ ...data, id: accountDoc.id });
                setOperationTypes(data.operationTypes || []);
                setBases(data.bases || []);
                setRentalPrices(data.rentalPrices || []);
                setTruckTypes(data.truckTypes || []);
            }
        } catch (error) {
            console.error('Error loading account:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleSection = (section: Section) => {
        setExpandedSection(expandedSection === section ? null : section);
    };

    // Operation Types handlers
    const handleAddOperationType = async () => {
        if (!newTypeName.trim()) {
            Alert.alert('Erro', 'Nome é obrigatório');
            return;
        }

        setSaving(true);
        const newType: OperationType = {
            id: Math.random().toString(36).substring(2, 10),
            name: newTypeName.trim(),
            value: Number(newTypeValue) || 0
        };

        const updated = [...operationTypes, newType];
        const result = await updateOperationTypesAction(accountId, updated);

        if (result.success) {
            setOperationTypes(updated);
            setNewTypeName('');
            setNewTypeValue('');
            setShowAddOperationType(false);
        } else {
            Alert.alert('Erro', result.error || 'Falha ao salvar');
        }
        setSaving(false);
    };

    const handleDeleteOperationType = async (id: string) => {
        const updated = operationTypes.filter(t => t.id !== id);
        setSaving(true);
        const result = await updateOperationTypesAction(accountId, updated);

        if (result.success) {
            setOperationTypes(updated);
        } else {
            Alert.alert('Erro', result.error || 'Falha ao excluir');
        }
        setSaving(false);
    };

    // Bases handlers
    const handleAddBase = async () => {
        if (!newBaseName.trim() || !newBaseAddress.trim()) {
            Alert.alert('Erro', 'Nome e endereço são obrigatórios');
            return;
        }

        setSaving(true);
        const newBase: Base = {
            id: Math.random().toString(36).substring(2, 10),
            name: newBaseName.trim(),
            address: newBaseAddress.trim()
        };

        const updated = [...bases, newBase];
        const result = await updateBasesAction(accountId, updated);

        if (result.success) {
            setBases(updated);
            setNewBaseName('');
            setNewBaseAddress('');
            setShowAddBase(false);
        } else {
            Alert.alert('Erro', result.error || 'Falha ao salvar');
        }
        setSaving(false);
    };

    const handleDeleteBase = async (id: string) => {
        const updated = bases.filter(b => b.id !== id);
        setSaving(true);
        const result = await updateBasesAction(accountId, updated);

        if (result.success) {
            setBases(updated);
        } else {
            Alert.alert('Erro', result.error || 'Falha ao excluir');
        }
        setSaving(false);
    };

    // Rental Prices handlers
    const handleAddRentalPrice = async () => {
        if (!newPriceName.trim()) {
            Alert.alert('Erro', 'Nome é obrigatório');
            return;
        }

        setSaving(true);
        const newPrice: RentalPrice = {
            id: Math.random().toString(36).substring(2, 10),
            name: newPriceName.trim(),
            value: Number(newPriceValue) || 0
        };

        const updated = [...rentalPrices, newPrice];
        const result = await updateRentalPricesAction(accountId, updated);

        if (result.success) {
            setRentalPrices(updated);
            setNewPriceName('');
            setNewPriceValue('');
            setShowAddPrice(false);
        } else {
            Alert.alert('Erro', result.error || 'Falha ao salvar');
        }
        setSaving(false);
    };

    const handleDeleteRentalPrice = async (id: string) => {
        const updated = rentalPrices.filter(p => p.id !== id);
        setSaving(true);
        const result = await updateRentalPricesAction(accountId, updated);

        if (result.success) {
            setRentalPrices(updated);
        } else {
            Alert.alert('Erro', result.error || 'Falha ao excluir');
        }
        setSaving(false);
    };

    // Truck Types handlers
    const handleAddTruckType = async () => {
        if (!newTruckTypeName.trim()) {
            Alert.alert('Erro', 'Nome é obrigatório');
            return;
        }

        setSaving(true);
        const newTruckType: TruckType = {
            id: Math.random().toString(36).substring(2, 10),
            name: newTruckTypeName.trim()
        };

        const updated = [...truckTypes, newTruckType];
        const result = await updateTruckTypesAction(accountId, updated);

        if (result.success) {
            setTruckTypes(updated);
            setNewTruckTypeName('');
            setShowAddTruckType(false);
        } else {
            Alert.alert('Erro', result.error || 'Falha ao salvar');
        }
        setSaving(false);
    };

    const handleDeleteTruckType = async (id: string) => {
        const updated = truckTypes.filter(t => t.id !== id);
        setSaving(true);
        const result = await updateTruckTypesAction(accountId, updated);

        if (result.success) {
            setTruckTypes(updated);
        } else {
            Alert.alert('Erro', result.error || 'Falha ao excluir');
        }
        setSaving(false);
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(value);
    };

    const renderSectionHeader = (
        section: Section,
        icon: React.ReactNode,
        title: string,
        subtitle: string,
        count: number
    ) => {
        const isExpanded = expandedSection === section;
        return (
            <TouchableOpacity
                onPress={() => toggleSection(section)}
                className="flex-row items-center justify-between p-4"
            >
                <View className="flex-row items-center flex-1">
                    <View className="w-10 h-10 bg-orange-100 rounded-full items-center justify-center mr-3">
                        {icon}
                    </View>
                    <View className="flex-1">
                        <Text className="font-semibold text-gray-900">{title}</Text>
                        <Text className="text-gray-500 text-xs">{subtitle}</Text>
                    </View>
                </View>
                <View className="flex-row items-center">
                    <View className="bg-gray-100 px-2 py-1 rounded-full mr-2">
                        <Text className="text-gray-600 text-sm">{count}</Text>
                    </View>
                    {isExpanded ? (
                        <ChevronUp size={20} color="#6B7280" />
                    ) : (
                        <ChevronDown size={20} color="#6B7280" />
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50" edges={['bottom']}>
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Configurações Avançadas',
                    headerLeft: () => (
                        <TouchableOpacity onPress={() => router.back()} className="mr-2">
                            <ChevronLeft size={24} color="#171717" />
                        </TouchableOpacity>
                    ),
                }}
            />

            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#FF9500" />
                </View>
            ) : (
                <ScrollView className="flex-1 p-4">
                    {/* Operation Types */}
                    <Card className="mb-4">
                        {renderSectionHeader(
                            'operation-types',
                            <Workflow size={20} color="#FF9500" />,
                            'Tipos de Operação',
                            'Personalize os tipos de operações',
                            operationTypes.length
                        )}
                        {expandedSection === 'operation-types' && (
                            <CardContent className="pt-0 border-t border-gray-100">
                                {operationTypes.map((type) => (
                                    <View key={type.id} className="flex-row items-center justify-between py-3 border-b border-gray-50">
                                        <View>
                                            <Text className="font-medium text-gray-900">{type.name}</Text>
                                            <Text className="text-gray-500 text-sm">{formatCurrency(type.value)}</Text>
                                        </View>
                                        <TouchableOpacity onPress={() => handleDeleteOperationType(type.id)} disabled={saving}>
                                            <Trash2 size={18} color="#DC2626" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                                <TouchableOpacity
                                    onPress={() => setShowAddOperationType(true)}
                                    className="flex-row items-center justify-center py-3 mt-2 bg-orange-50 rounded-lg"
                                >
                                    <Plus size={18} color="#FF9500" />
                                    <Text className="text-orange-600 font-medium ml-2">Adicionar Tipo</Text>
                                </TouchableOpacity>
                            </CardContent>
                        )}
                    </Card>

                    {/* Bases */}
                    <Card className="mb-4">
                        {renderSectionHeader(
                            'bases',
                            <MapPin size={20} color="#FF9500" />,
                            'Bases de Operação',
                            'Endereços de onde saem os caminhões',
                            bases.length
                        )}
                        {expandedSection === 'bases' && (
                            <CardContent className="pt-0 border-t border-gray-100">
                                {bases.map((base) => (
                                    <View key={base.id} className="flex-row items-center justify-between py-3 border-b border-gray-50">
                                        <View className="flex-1 mr-4">
                                            <Text className="font-medium text-gray-900">{base.name}</Text>
                                            <Text className="text-gray-500 text-xs" numberOfLines={1}>{base.address}</Text>
                                        </View>
                                        <TouchableOpacity onPress={() => handleDeleteBase(base.id)} disabled={saving}>
                                            <Trash2 size={18} color="#DC2626" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                                <TouchableOpacity
                                    onPress={() => setShowAddBase(true)}
                                    className="flex-row items-center justify-center py-3 mt-2 bg-orange-50 rounded-lg"
                                >
                                    <Plus size={18} color="#FF9500" />
                                    <Text className="text-orange-600 font-medium ml-2">Adicionar Base</Text>
                                </TouchableOpacity>
                            </CardContent>
                        )}
                    </Card>

                    {/* Rental Prices */}
                    <Card className="mb-4">
                        {renderSectionHeader(
                            'rental-prices',
                            <Tag size={20} color="#FF9500" />,
                            'Tabela de Diárias',
                            'Valores pré-definidos para aluguéis',
                            rentalPrices.length
                        )}
                        {expandedSection === 'rental-prices' && (
                            <CardContent className="pt-0 border-t border-gray-100">
                                {rentalPrices.map((price) => (
                                    <View key={price.id} className="flex-row items-center justify-between py-3 border-b border-gray-50">
                                        <View>
                                            <Text className="font-medium text-gray-900">{price.name}</Text>
                                            <Text className="text-green-600 font-semibold">{formatCurrency(price.value)}</Text>
                                        </View>
                                        <TouchableOpacity onPress={() => handleDeleteRentalPrice(price.id)} disabled={saving}>
                                            <Trash2 size={18} color="#DC2626" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                                <TouchableOpacity
                                    onPress={() => setShowAddPrice(true)}
                                    className="flex-row items-center justify-center py-3 mt-2 bg-orange-50 rounded-lg"
                                >
                                    <Plus size={18} color="#FF9500" />
                                    <Text className="text-orange-600 font-medium ml-2">Adicionar Preço</Text>
                                </TouchableOpacity>
                            </CardContent>
                        )}
                    </Card>

                    {/* Truck Types */}
                    <Card className="mb-4">
                        {renderSectionHeader(
                            'truck-types',
                            <Truck size={20} color="#FF9500" />,
                            'Tipos de Caminhão',
                            'Categorias de veículos',
                            truckTypes.length
                        )}
                        {expandedSection === 'truck-types' && (
                            <CardContent className="pt-0 border-t border-gray-100">
                                {truckTypes.map((type) => (
                                    <View key={type.id} className="flex-row items-center justify-between py-3 border-b border-gray-50">
                                        <Text className="font-medium text-gray-900">{type.name}</Text>
                                        <TouchableOpacity onPress={() => handleDeleteTruckType(type.id)} disabled={saving}>
                                            <Trash2 size={18} color="#DC2626" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                                <TouchableOpacity
                                    onPress={() => setShowAddTruckType(true)}
                                    className="flex-row items-center justify-center py-3 mt-2 bg-orange-50 rounded-lg"
                                >
                                    <Plus size={18} color="#FF9500" />
                                    <Text className="text-orange-600 font-medium ml-2">Adicionar Tipo</Text>
                                </TouchableOpacity>
                            </CardContent>
                        )}
                    </Card>

                    <View className="h-8" />
                </ScrollView>
            )}

            {/* Add Operation Type Modal */}
            <Modal visible={showAddOperationType} transparent animationType="slide" onRequestClose={() => setShowAddOperationType(false)}>
                <View className="flex-1 bg-black/50 justify-end">
                    <View className="bg-white rounded-t-3xl p-6">
                        <View className="flex-row items-center justify-between mb-4">
                            <Text className="text-lg font-bold text-gray-900">Novo Tipo de Operação</Text>
                            <TouchableOpacity onPress={() => setShowAddOperationType(false)}>
                                <X size={24} color="#6B7280" />
                            </TouchableOpacity>
                        </View>
                        <View className="mb-4">
                            <Text className="text-sm font-medium text-gray-700 mb-1">Nome</Text>
                            <TextInput
                                value={newTypeName}
                                onChangeText={setNewTypeName}
                                placeholder="Ex: Coleta de Entulho"
                                className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3"
                            />
                        </View>
                        <View className="mb-6">
                            <Text className="text-sm font-medium text-gray-700 mb-1">Valor Padrão (R$)</Text>
                            <TextInput
                                value={newTypeValue}
                                onChangeText={setNewTypeValue}
                                placeholder="0"
                                keyboardType="numeric"
                                className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3"
                            />
                        </View>
                        <TouchableOpacity
                            onPress={handleAddOperationType}
                            disabled={saving}
                            className={`py-4 rounded-lg items-center ${saving ? 'bg-gray-300' : 'bg-orange-500'}`}
                        >
                            {saving ? <ActivityIndicator color="#FFF" /> : <Text className="text-white font-bold">Adicionar</Text>}
                        </TouchableOpacity>
                        <View className="h-6" />
                    </View>
                </View>
            </Modal>

            {/* Add Base Modal */}
            <Modal visible={showAddBase} transparent animationType="slide" onRequestClose={() => setShowAddBase(false)}>
                <View className="flex-1 bg-black/50 justify-end">
                    <View className="bg-white rounded-t-3xl p-6">
                        <View className="flex-row items-center justify-between mb-4">
                            <Text className="text-lg font-bold text-gray-900">Nova Base</Text>
                            <TouchableOpacity onPress={() => setShowAddBase(false)}>
                                <X size={24} color="#6B7280" />
                            </TouchableOpacity>
                        </View>
                        <View className="mb-4">
                            <Text className="text-sm font-medium text-gray-700 mb-1">Nome</Text>
                            <TextInput
                                value={newBaseName}
                                onChangeText={setNewBaseName}
                                placeholder="Ex: Base Central"
                                className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3"
                            />
                        </View>
                        <View className="mb-6">
                            <Text className="text-sm font-medium text-gray-700 mb-1">Endereço</Text>
                            <TextInput
                                value={newBaseAddress}
                                onChangeText={setNewBaseAddress}
                                placeholder="Endereço completo"
                                multiline
                                className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3"
                            />
                        </View>
                        <TouchableOpacity
                            onPress={handleAddBase}
                            disabled={saving}
                            className={`py-4 rounded-lg items-center ${saving ? 'bg-gray-300' : 'bg-orange-500'}`}
                        >
                            {saving ? <ActivityIndicator color="#FFF" /> : <Text className="text-white font-bold">Adicionar</Text>}
                        </TouchableOpacity>
                        <View className="h-6" />
                    </View>
                </View>
            </Modal>

            {/* Add Rental Price Modal */}
            <Modal visible={showAddPrice} transparent animationType="slide" onRequestClose={() => setShowAddPrice(false)}>
                <View className="flex-1 bg-black/50 justify-end">
                    <View className="bg-white rounded-t-3xl p-6">
                        <View className="flex-row items-center justify-between mb-4">
                            <Text className="text-lg font-bold text-gray-900">Nova Tabela de Preço</Text>
                            <TouchableOpacity onPress={() => setShowAddPrice(false)}>
                                <X size={24} color="#6B7280" />
                            </TouchableOpacity>
                        </View>
                        <View className="mb-4">
                            <Text className="text-sm font-medium text-gray-700 mb-1">Nome</Text>
                            <TextInput
                                value={newPriceName}
                                onChangeText={setNewPriceName}
                                placeholder="Ex: Diária 5m³"
                                className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3"
                            />
                        </View>
                        <View className="mb-6">
                            <Text className="text-sm font-medium text-gray-700 mb-1">Valor (R$)</Text>
                            <TextInput
                                value={newPriceValue}
                                onChangeText={setNewPriceValue}
                                placeholder="0"
                                keyboardType="numeric"
                                className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3"
                            />
                        </View>
                        <TouchableOpacity
                            onPress={handleAddRentalPrice}
                            disabled={saving}
                            className={`py-4 rounded-lg items-center ${saving ? 'bg-gray-300' : 'bg-orange-500'}`}
                        >
                            {saving ? <ActivityIndicator color="#FFF" /> : <Text className="text-white font-bold">Adicionar</Text>}
                        </TouchableOpacity>
                        <View className="h-6" />
                    </View>
                </View>
            </Modal>

            {/* Add Truck Type Modal */}
            <Modal visible={showAddTruckType} transparent animationType="slide" onRequestClose={() => setShowAddTruckType(false)}>
                <View className="flex-1 bg-black/50 justify-end">
                    <View className="bg-white rounded-t-3xl p-6">
                        <View className="flex-row items-center justify-between mb-4">
                            <Text className="text-lg font-bold text-gray-900">Novo Tipo de Caminhão</Text>
                            <TouchableOpacity onPress={() => setShowAddTruckType(false)}>
                                <X size={24} color="#6B7280" />
                            </TouchableOpacity>
                        </View>
                        <View className="mb-6">
                            <Text className="text-sm font-medium text-gray-700 mb-1">Nome</Text>
                            <TextInput
                                value={newTruckTypeName}
                                onChangeText={setNewTruckTypeName}
                                placeholder="Ex: Poliguindaste"
                                className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3"
                            />
                        </View>
                        <TouchableOpacity
                            onPress={handleAddTruckType}
                            disabled={saving}
                            className={`py-4 rounded-lg items-center ${saving ? 'bg-gray-300' : 'bg-orange-500'}`}
                        >
                            {saving ? <ActivityIndicator color="#FFF" /> : <Text className="text-white font-bold">Adicionar</Text>}
                        </TouchableOpacity>
                        <View className="h-6" />
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
