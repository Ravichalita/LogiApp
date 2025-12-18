import React, { useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, Modal, ActivityIndicator } from 'react-native';
import { X, Container, Check, AlertCircle } from 'lucide-react-native';
import { Dumpster, DUMPSTER_COLORS } from '../../lib/types';

interface DumpsterPickerProps {
    dumpsters: Dumpster[];
    selectedIds: string[];
    onSelectionChange: (ids: string[]) => void;
    loading?: boolean;
    multiple?: boolean;
}

export function DumpsterPicker({
    dumpsters,
    selectedIds,
    onSelectionChange,
    loading,
    multiple = true
}: DumpsterPickerProps) {
    const [visible, setVisible] = useState(false);

    const availableDumpsters = dumpsters.filter(d => d.status === 'Disponível');
    const selectedDumpsters = dumpsters.filter(d => selectedIds.includes(d.id));

    const toggleSelection = (id: string) => {
        if (multiple) {
            if (selectedIds.includes(id)) {
                onSelectionChange(selectedIds.filter(i => i !== id));
            } else {
                onSelectionChange([...selectedIds, id]);
            }
        } else {
            onSelectionChange([id]);
            setVisible(false);
        }
    };

    const getColorValue = (colorName: string) => {
        return DUMPSTER_COLORS[colorName as keyof typeof DUMPSTER_COLORS]?.value || '#6c757d';
    };

    return (
        <>
            <TouchableOpacity
                onPress={() => setVisible(true)}
                className="flex-row items-center justify-between border border-gray-300 rounded-lg p-3 bg-white"
            >
                <View className="flex-1">
                    {selectedDumpsters.length > 0 ? (
                        <View>
                            <Text className="font-medium text-gray-900">
                                {selectedDumpsters.map(d => d.name).join(', ')}
                            </Text>
                            <Text className="text-sm text-gray-500">
                                {selectedDumpsters.length} caçamba(s) selecionada(s)
                            </Text>
                        </View>
                    ) : (
                        <Text className="text-gray-400">Selecione a(s) caçamba(s)</Text>
                    )}
                </View>
                <Container size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <Modal
                visible={visible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setVisible(false)}
            >
                <View className="flex-1 bg-white">
                    <View className="flex-row items-center justify-between p-4 border-b border-gray-200">
                        <Text className="text-xl font-bold text-gray-900">
                            {multiple ? 'Selecionar Caçambas' : 'Selecionar Caçamba'}
                        </Text>
                        <TouchableOpacity onPress={() => setVisible(false)}>
                            <X size={24} color="#6B7280" />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <View className="flex-1 items-center justify-center">
                            <ActivityIndicator size="large" color="#FF9500" />
                        </View>
                    ) : (
                        <FlatList
                            data={dumpsters}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={{ padding: 16 }}
                            ListEmptyComponent={
                                <Text className="text-center text-gray-500 py-8">
                                    Nenhuma caçamba cadastrada
                                </Text>
                            }
                            renderItem={({ item }) => {
                                const isSelected = selectedIds.includes(item.id);
                                const isAvailable = item.status === 'Disponível';

                                return (
                                    <TouchableOpacity
                                        onPress={() => isAvailable && toggleSelection(item.id)}
                                        disabled={!isAvailable}
                                        className={`p-4 mb-2 rounded-lg border flex-row items-center ${isSelected
                                                ? 'border-orange-500 bg-orange-50'
                                                : isAvailable
                                                    ? 'border-gray-200 bg-white'
                                                    : 'border-gray-100 bg-gray-50'
                                            }`}
                                    >
                                        <View
                                            className="w-10 h-10 rounded-lg items-center justify-center mr-3"
                                            style={{ backgroundColor: getColorValue(item.color) + '20' }}
                                        >
                                            <Container size={20} color={getColorValue(item.color)} />
                                        </View>

                                        <View className="flex-1">
                                            <Text className={`font-semibold ${isAvailable ? 'text-gray-900' : 'text-gray-400'}`}>
                                                {item.name}
                                            </Text>
                                            <Text className={`text-sm ${isAvailable ? 'text-gray-600' : 'text-gray-400'}`}>
                                                {item.size}m³ • {item.color}
                                            </Text>
                                            {!isAvailable && (
                                                <View className="flex-row items-center mt-1">
                                                    <AlertCircle size={12} color="#EF4444" />
                                                    <Text className="text-xs text-red-500 ml-1">{item.status}</Text>
                                                </View>
                                            )}
                                        </View>

                                        {isSelected && (
                                            <Check size={20} color="#FF9500" />
                                        )}
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    )}

                    {multiple && (
                        <View className="p-4 border-t border-gray-200">
                            <TouchableOpacity
                                onPress={() => setVisible(false)}
                                className="bg-orange-500 rounded-lg py-3 items-center"
                            >
                                <Text className="text-white font-semibold">
                                    Confirmar ({selectedIds.length} selecionada{selectedIds.length !== 1 ? 's' : ''})
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </Modal>
        </>
    );
}
