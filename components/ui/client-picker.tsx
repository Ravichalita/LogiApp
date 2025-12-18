import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, FlatList, Modal, TextInput, ActivityIndicator, SectionList } from 'react-native';
import { Search, X, User, Phone, MapPin, Check, Star, Building, ShieldCheck } from 'lucide-react-native';
import { Client } from '../../lib/types';

interface ClassifiedClients {
    newClients: Client[];
    activeClients: Client[];
    completedClients: Client[];
    unservedClients: Client[];
}

interface ClientPickerProps {
    clients: Client[];
    classifiedClients?: ClassifiedClients;
    selectedClientId?: string;
    onSelect: (clientId: string) => void;
    loading?: boolean;
}

export function ClientPicker({ clients, classifiedClients, selectedClientId, onSelect, loading }: ClientPickerProps) {
    const [visible, setVisible] = useState(false);
    const [search, setSearch] = useState('');

    const selectedClient = clients.find(c => c.id === selectedClientId);

    const sections = useMemo(() => {
        if (!classifiedClients) return [];

        const filter = (list: Client[]) => list.filter(c =>
            c.name.toLowerCase().includes(search.toLowerCase()) ||
            c.phone?.includes(search) ||
            c.address?.toLowerCase().includes(search.toLowerCase())
        );

        const result = [];

        const newC = filter(classifiedClients.newClients);
        if (newC.length > 0) result.push({ title: 'Novos Clientes', data: newC, icon: <Star size={16} color="#F59E0B" /> });

        const activeC = filter(classifiedClients.activeClients);
        if (activeC.length > 0) result.push({ title: 'Em Atendimento', data: activeC, icon: <Building size={16} color="#3B82F6" /> });

        const completedC = filter(classifiedClients.completedClients);
        if (completedC.length > 0) result.push({ title: 'Concluídos', data: completedC, icon: <ShieldCheck size={16} color="#10B981" /> });

        const unservedC = filter(classifiedClients.unservedClients);
        if (unservedC.length > 0) result.push({ title: 'Não Atendidos', data: unservedC, icon: <User size={16} color="#6B7280" /> });

        // If we have classified clients but searching returns nothing in those groups, 
        // fallback to filtering the main list if needed, OR just show empty.
        // But wait, "clients" prop contains ALL clients. 
        // If classifiedClients is provided, we should ONLY rely on it?
        // Let's assume classifiedClients covers everyone. 

        return result;
    }, [classifiedClients, search]);

    const filteredClients = useMemo(() => {
        return clients.filter(c =>
            c.name.toLowerCase().includes(search.toLowerCase()) ||
            c.phone?.includes(search) ||
            c.address?.toLowerCase().includes(search.toLowerCase())
        );
    }, [clients, search]);


    const handleSelect = (clientId: string) => {
        onSelect(clientId);
        setVisible(false);
        setSearch('');
    };

    const renderClientItem = ({ item }: { item: Client }) => (
        <TouchableOpacity
            onPress={() => handleSelect(item.id)}
            className={`p-4 mb-2 rounded-lg border ${item.id === selectedClientId
                ? 'border-orange-500 bg-orange-50'
                : 'border-gray-200 bg-white'
                }`}
        >
            <View className="flex-row items-start justify-between">
                <View className="flex-1">
                    <Text className="font-semibold text-gray-900">{item.name}</Text>
                    {item.phone && (
                        <View className="flex-row items-center mt-1">
                            <Phone size={14} color="#6B7280" />
                            <Text className="text-sm text-gray-600 ml-1">{item.phone}</Text>
                        </View>
                    )}
                    {item.address && (
                        <View className="flex-row items-start mt-1">
                            <MapPin size={14} color="#6B7280" style={{ marginTop: 2 }} />
                            <Text className="text-sm text-gray-500 ml-1 flex-1" numberOfLines={2}>
                                {item.address}
                            </Text>
                        </View>
                    )}
                </View>
                {item.id === selectedClientId && (
                    <Check size={20} color="#FF9500" />
                )}
            </View>
        </TouchableOpacity>
    );

    return (
        <>
            <TouchableOpacity
                onPress={() => setVisible(true)}
                className="flex-row items-center justify-between border border-gray-300 rounded-lg p-3 bg-white"
            >
                <View className="flex-1">
                    {selectedClient ? (
                        <View>
                            <Text className="font-medium text-gray-900">{selectedClient.name}</Text>
                            {selectedClient.phone && (
                                <Text className="text-sm text-gray-500">{selectedClient.phone}</Text>
                            )}
                        </View>
                    ) : (
                        <Text className="text-gray-400">Selecione um cliente</Text>
                    )}
                </View>
                <User size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <Modal
                visible={visible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setVisible(false)}
            >
                <View className="flex-1 bg-gray-50">
                    <View className="flex-row items-center justify-between p-4 bg-white border-b border-gray-200">
                        <Text className="text-xl font-bold text-gray-900">Selecionar Cliente</Text>
                        <TouchableOpacity onPress={() => setVisible(false)}>
                            <X size={24} color="#6B7280" />
                        </TouchableOpacity>
                    </View>

                    <View className="bg-white p-4 border-b border-gray-200">
                        <View className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2">
                            <Search size={20} color="#9CA3AF" />
                            <TextInput
                                value={search}
                                onChangeText={setSearch}
                                placeholder="Buscar por nome, telefone ou endereço..."
                                className="flex-1 ml-2 text-gray-900"
                                placeholderTextColor="#9CA3AF"
                            />
                            {search.length > 0 && (
                                <TouchableOpacity onPress={() => setSearch('')}>
                                    <X size={18} color="#9CA3AF" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {loading ? (
                        <View className="flex-1 items-center justify-center">
                            <ActivityIndicator size="large" color="#FF9500" />
                        </View>
                    ) : (
                        classifiedClients && sections.length > 0 ? (
                            <SectionList
                                sections={sections}
                                keyExtractor={(item) => item.id}
                                contentContainerStyle={{ padding: 16 }}
                                stickySectionHeadersEnabled={false}
                                renderItem={renderClientItem}
                                renderSectionHeader={({ section: { title, icon } }) => (
                                    <View className="flex-row items-center mb-2 mt-4 first:mt-0">
                                        {icon}
                                        <Text className="ml-2 font-bold text-gray-700">{title}</Text>
                                    </View>
                                )}
                                ListEmptyComponent={
                                    <Text className="text-center text-gray-500 py-8">
                                        Nenhum cliente encontrado
                                    </Text>
                                }
                            />
                        ) : (
                            <FlatList
                                data={filteredClients}
                                keyExtractor={(item) => item.id}
                                contentContainerStyle={{ padding: 16 }}
                                ListEmptyComponent={
                                    <Text className="text-center text-gray-500 py-8">
                                        Nenhum cliente encontrado
                                    </Text>
                                }
                                renderItem={renderClientItem}
                            />
                        )
                    )}
                </View>
            </Modal>
        </>
    );
}
