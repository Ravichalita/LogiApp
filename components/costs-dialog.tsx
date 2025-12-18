import React, { useState, useEffect } from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Plus, Trash2, X, DollarSign } from 'lucide-react-native';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { AdditionalCost } from '../lib/types';

interface CostsDialogProps {
    costs: AdditionalCost[];
    onSave: (costs: AdditionalCost[]) => void;
    children: React.ReactNode;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export function CostsDialog({ costs: initialCosts, onSave, children }: CostsDialogProps) {
    const [visible, setVisible] = useState(false);
    const [currentCosts, setCurrentCosts] = useState<AdditionalCost[]>([]);

    // Check if initialCosts changes while modal is open (unlikely but good practice)
    useEffect(() => {
        if (visible) {
            const costsToSet = initialCosts.length > 0 ? initialCosts : [{ id: generateId(), name: '', value: 0 }];
            setCurrentCosts(JSON.parse(JSON.stringify(costsToSet)));
        }
    }, [visible, initialCosts]); // Only reset when opening

    const handleValueChange = (id: string, text: string) => {
        const cleanValue = text.replace(/\D/g, '');
        const numericValue = parseInt(cleanValue, 10) || 0;

        setCurrentCosts(current =>
            current.map(c => (c.id === id ? { ...c, value: numericValue / 100 } : c))
        );
    };

    const handleNameChange = (id: string, name: string) => {
        setCurrentCosts(current =>
            current.map(c => (c.id === id ? { ...c, name } : c))
        );
    };

    const addCost = () => {
        setCurrentCosts(current => [...current, { id: generateId(), name: '', value: 0 }]);
    };

    const removeCost = (id: string) => {
        if (currentCosts.length === 1) {
            // Simply clear the last one instead of removing
            setCurrentCosts([{ id: generateId(), name: '', value: 0 }]);
            return;
        }
        setCurrentCosts(current => current.filter(c => c.id !== id));
    };

    const handleConfirm = () => {
        const validCosts = currentCosts.filter(c => c.name.trim() !== '' && c.value > 0);
        onSave(validCosts);
        setVisible(false);
    };

    const formatCurrency = (value: number) => {
        return value.toFixed(2).replace('.', ',');
    };

    const formatCurrencyInput = (value: number) => {
        const numericValue = Math.round(value * 100);
        const reais = Math.floor(numericValue / 100);
        const centavos = (numericValue % 100).toString().padStart(2, '0');
        return `${reais},${centavos}`;
    };

    const total = currentCosts.reduce((acc, cost) => acc + cost.value, 0);

    return (
        <>
            <TouchableOpacity onPress={() => setVisible(true)}>
                {children}
            </TouchableOpacity>

            <Modal
                visible={visible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setVisible(false)}
            >
                <View className="flex-1 bg-white">
                    {/* Header */}
                    <View className="flex-row items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                        <Text className="text-xl font-headline font-bold text-gray-900">Custos Adicionais</Text>
                        <TouchableOpacity onPress={() => setVisible(false)}>
                            <X size={24} color="#6B7280" />
                        </TouchableOpacity>
                    </View>

                    <View className="flex-1 p-4 bg-gray-50">
                        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                            {currentCosts.map((cost, index) => (
                                <View key={cost.id} className="mb-4 flex-row items-start gap-2">
                                    <View className="flex-1 space-y-2">
                                        <View>
                                            <Label className="mb-1 text-xs text-gray-500">Descrição</Label>
                                            <Input
                                                placeholder="Ex: Ajudante, Pedágio"
                                                value={cost.name}
                                                onChangeText={(text) => handleNameChange(cost.id, text)}
                                            />
                                        </View>
                                        <View>
                                            <Label className="mb-1 text-xs text-gray-500">Valor (R$)</Label>
                                            <Input
                                                placeholder="0,00"
                                                value={formatCurrencyInput(cost.value)}
                                                onChangeText={(text) => handleValueChange(cost.id, text)}
                                                keyboardType="numeric"
                                            />
                                        </View>
                                    </View>

                                    <View className="pt-6 justify-center">
                                        <TouchableOpacity
                                            onPress={() => index === currentCosts.length - 1 ? addCost() : removeCost(cost.id)}
                                            className={`p-3 rounded-full ${index === currentCosts.length - 1 ? 'bg-blue-100' : 'bg-red-100'}`}
                                        >
                                            {index === currentCosts.length - 1 ? (
                                                <Plus size={20} color="#3B82F6" />
                                            ) : (
                                                <Trash2 size={20} color="#EF4444" />
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                        </ScrollView>

                        <View className="mt-4 pt-4 border-t border-gray-200">
                            <Button onPress={handleConfirm} className="w-full bg-orange-500">
                                Confirmar (Total: R$ {formatCurrency(total)})
                            </Button>
                        </View>
                    </View>
                </View>
            </Modal>
        </>
    );
}
