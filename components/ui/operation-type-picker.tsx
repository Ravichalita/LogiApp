import React, { useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, Modal, ActivityIndicator } from 'react-native';
import { X, Briefcase, Check } from 'lucide-react-native';
import { OperationType } from '../../lib/types';

interface OperationTypePickerProps {
    operationTypes: OperationType[];
    selectedIds: string[];
    onSelectionChange: (ids: string[]) => void;
    loading?: boolean;
    multiple?: boolean;
}

export function OperationTypePicker({
    operationTypes,
    selectedIds,
    onSelectionChange,
    loading,
    multiple = true
}: OperationTypePickerProps) {
    const [visible, setVisible] = useState(false);

    const selectedTypes = operationTypes.filter(t => selectedIds.includes(t.id));

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

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(value);
    };

    return (
        <>
            <TouchableOpacity
                onPress={() => setVisible(true)}
                className="flex-row items-center justify-between border border-gray-300 rounded-lg p-3 bg-white"
            >
                <View className="flex-1">
                    {selectedTypes.length > 0 ? (
                        <View>
                            <Text className="font-medium text-gray-900">
                                {selectedTypes.map(t => t.name).join(', ')}
                            </Text>
                            <Text className="text-sm text-gray-500">
                                {selectedTypes.length} tipo(s) selecionado(s)
                            </Text>
                        </View>
                    ) : (
                        <Text className="text-gray-400">Selecione o(s) tipo(s) de operação</Text>
                    )}
                </View>
                <Briefcase size={20} color="#9CA3AF" />
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
                            {multiple ? 'Selecionar Tipos' : 'Selecionar Tipo'}
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
                            data={operationTypes}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={{ padding: 16 }}
                            ListEmptyComponent={
                                <Text className="text-center text-gray-500 py-8">
                                    Nenhum tipo de operação cadastrado
                                </Text>
                            }
                            renderItem={({ item }) => {
                                const isSelected = selectedIds.includes(item.id);

                                return (
                                    <TouchableOpacity
                                        onPress={() => toggleSelection(item.id)}
                                        className={`p-4 mb-2 rounded-lg border flex-row items-center ${isSelected
                                                ? 'border-orange-500 bg-orange-50'
                                                : 'border-gray-200 bg-white'
                                            }`}
                                    >
                                        <View
                                            className="w-10 h-10 rounded-lg items-center justify-center mr-3 bg-orange-100"
                                        >
                                            <Briefcase size={20} color="#FF9500" />
                                        </View>

                                        <View className="flex-1">
                                            <Text className="font-semibold text-gray-900">
                                                {item.name}
                                            </Text>
                                            {item.value > 0 && (
                                                <Text className="text-sm text-gray-600">
                                                    {formatCurrency(item.value)}
                                                </Text>
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
                                    Confirmar ({selectedIds.length} selecionado{selectedIds.length !== 1 ? 's' : ''})
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </Modal>
        </>
    );
}
