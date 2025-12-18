import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    Alert,
    TouchableOpacity,
    Platform,
    KeyboardAvoidingView,
    ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Clock, MapPin, DollarSign, FileText } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { doc, getDoc } from 'firebase/firestore';

import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { ClientPicker } from '../../components/ui/client-picker';
import { OperationTypePicker } from '../../components/ui/operation-type-picker';

import { getFirebase } from '../../lib/firebase';
import { getClients, getOperationTypes } from '../../lib/data';
import { updateOperationAction, UpdateOperationData } from '../../lib/actions';
import { Client, OperationType } from '../../lib/types';

export default function EditOperationScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { auth, db } = getFirebase();

    // Data states
    const [clients, setClients] = useState<Client[]>([]);
    const [operationTypes, setOperationTypes] = useState<OperationType[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [loadingOperation, setLoadingOperation] = useState(true);

    // Form states
    const [selectedTypeIds, setSelectedTypeIds] = useState<string[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>();
    const [destinationAddress, setDestinationAddress] = useState('');
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(new Date());
    const [value, setValue] = useState('');
    const [observations, setObservations] = useState('');

    // UI states
    const [showStartDatePicker, setShowStartDatePicker] = useState(false);
    const [showStartTimePicker, setShowStartTimePicker] = useState(false);
    const [showEndDatePicker, setShowEndDatePicker] = useState(false);
    const [showEndTimePicker, setShowEndTimePicker] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [accountId, setAccountId] = useState<string>('');

    useEffect(() => {
        const loadAccountId = async () => {
            const user = auth.currentUser;
            if (user) {
                const token = await user.getIdTokenResult();
                setAccountId(token.claims.accountId as string || '');
            }
        };
        loadAccountId();
    }, []);

    // Load operation data
    useEffect(() => {
        if (!accountId || !id) return;

        const loadOperation = async () => {
            try {
                const operationRef = doc(db, `accounts/${accountId}/operations`, id);
                const operationSnap = await getDoc(operationRef);

                if (operationSnap.exists()) {
                    const data = operationSnap.data();
                    setSelectedTypeIds(data.typeIds || []);
                    setSelectedClientId(data.clientId);
                    setDestinationAddress(data.destinationAddress || '');
                    setStartDate(new Date(data.startDate));
                    setEndDate(new Date(data.endDate));
                    setValue(data.value?.toFixed(2).replace('.', ',') || '0,00');
                    setObservations(data.observations || '');
                }
            } catch (error) {
                console.error('Error loading operation:', error);
                Alert.alert('Erro', 'Falha ao carregar dados da operação.');
            } finally {
                setLoadingOperation(false);
            }
        };

        loadOperation();
    }, [accountId, id]);

    // Load clients and operation types
    useEffect(() => {
        if (!accountId) return;

        const unsubClients = getClients(accountId, (data) => {
            setClients(data);
        });

        getOperationTypes(accountId).then((types) => {
            setOperationTypes(types);
            setLoadingData(false);
        });

        return () => {
            unsubClients();
        };
    }, [accountId]);

    const handleSubmit = async () => {
        if (selectedTypeIds.length === 0) {
            Alert.alert('Erro', 'Selecione pelo menos um tipo de operação.');
            return;
        }
        if (!selectedClientId) {
            Alert.alert('Erro', 'Selecione um cliente.');
            return;
        }
        if (!destinationAddress.trim()) {
            Alert.alert('Erro', 'Informe o endereço de destino.');
            return;
        }

        const numericValue = parseFloat(value.replace(',', '.')) || 0;

        setSubmitting(true);

        try {
            const data: UpdateOperationData = {
                typeIds: selectedTypeIds,
                clientId: selectedClientId,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                destinationAddress: destinationAddress.trim(),
                value: numericValue,
                observations: observations.trim(),
            };

            const result = await updateOperationAction(accountId, id, data);

            if (result.success) {
                Alert.alert('Sucesso', 'Operação atualizada com sucesso!', [
                    { text: 'OK', onPress: () => router.back() }
                ]);
            } else {
                Alert.alert('Erro', result.error || 'Falha ao atualizar operação.');
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Erro', 'Ocorreu um erro ao atualizar a operação.');
        } finally {
            setSubmitting(false);
        }
    };

    const formatCurrency = (text: string) => {
        const numbers = text.replace(/\D/g, '');
        const cents = parseInt(numbers, 10) || 0;
        const reais = (cents / 100).toFixed(2).replace('.', ',');
        return reais;
    };

    if (loadingOperation) {
        return (
            <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
                <ActivityIndicator size="large" color="#FF9500" />
                <Text className="mt-4 text-gray-500">Carregando dados...</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-gray-50" edges={['bottom']}>
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Editar Operação',
                    headerLeft: () => (
                        <TouchableOpacity onPress={() => router.back()} className="mr-2">
                            <ChevronLeft size={24} color="#171717" />
                        </TouchableOpacity>
                    ),
                }}
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >
                <ScrollView
                    className="flex-1"
                    contentContainerStyle={{ padding: 16 }}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Operation Type Selection */}
                    <Card className="mb-4">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Tipo de Operação</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <OperationTypePicker
                                operationTypes={operationTypes}
                                selectedIds={selectedTypeIds}
                                onSelectionChange={setSelectedTypeIds}
                                loading={loadingData}
                            />
                        </CardContent>
                    </Card>

                    {/* Client Selection */}
                    <Card className="mb-4">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Cliente</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ClientPicker
                                clients={clients}
                                selectedClientId={selectedClientId}
                                onSelect={setSelectedClientId}
                                loading={loadingData}
                            />
                        </CardContent>
                    </Card>

                    {/* Dates and Times */}
                    <Card className="mb-4">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex-row items-center">
                                <Clock size={16} color="#FF9500" />
                                <Text className="ml-2 text-base font-semibold">Período</Text>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <View className="mb-4">
                                <Label>Início</Label>
                                <View className="flex-row gap-2 mt-1">
                                    <TouchableOpacity
                                        onPress={() => setShowStartDatePicker(true)}
                                        className="flex-1 border border-gray-300 rounded-lg p-3 bg-white"
                                    >
                                        <Text className="text-gray-900">
                                            {format(startDate, 'dd/MM/yyyy', { locale: ptBR })}
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => setShowStartTimePicker(true)}
                                        className="border border-gray-300 rounded-lg p-3 bg-white px-6"
                                    >
                                        <Text className="text-gray-900">
                                            {format(startDate, 'HH:mm')}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View>
                                <Label>Término</Label>
                                <View className="flex-row gap-2 mt-1">
                                    <TouchableOpacity
                                        onPress={() => setShowEndDatePicker(true)}
                                        className="flex-1 border border-gray-300 rounded-lg p-3 bg-white"
                                    >
                                        <Text className="text-gray-900">
                                            {format(endDate, 'dd/MM/yyyy', { locale: ptBR })}
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => setShowEndTimePicker(true)}
                                        className="border border-gray-300 rounded-lg p-3 bg-white px-6"
                                    >
                                        <Text className="text-gray-900">
                                            {format(endDate, 'HH:mm')}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </CardContent>
                    </Card>

                    {/* Address */}
                    <Card className="mb-4">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex-row items-center">
                                <MapPin size={16} color="#FF9500" />
                                <Text className="ml-2 text-base font-semibold">Endereço de Destino</Text>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Input
                                placeholder="Endereço completo"
                                value={destinationAddress}
                                onChangeText={setDestinationAddress}
                                multiline
                                numberOfLines={2}
                            />
                        </CardContent>
                    </Card>

                    {/* Value */}
                    <Card className="mb-4">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex-row items-center">
                                <DollarSign size={16} color="#FF9500" />
                                <Text className="ml-2 text-base font-semibold">Valor</Text>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Input
                                label="Valor do serviço (R$)"
                                placeholder="0,00"
                                value={value}
                                onChangeText={(text) => setValue(formatCurrency(text))}
                                keyboardType="numeric"
                            />
                        </CardContent>
                    </Card>

                    {/* Observations */}
                    <Card className="mb-4">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex-row items-center">
                                <FileText size={16} color="#FF9500" />
                                <Text className="ml-2 text-base font-semibold">Observações</Text>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Input
                                placeholder="Observações adicionais (opcional)"
                                value={observations}
                                onChangeText={setObservations}
                                multiline
                                numberOfLines={3}
                            />
                        </CardContent>
                    </Card>

                    {/* Submit Button */}
                    <Button
                        className="mt-4 mb-8 bg-orange-500"
                        onPress={handleSubmit}
                        loading={submitting}
                    >
                        Salvar Alterações
                    </Button>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Date/Time Pickers */}
            {showStartDatePicker && (
                <DateTimePicker
                    value={startDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, date) => {
                        setShowStartDatePicker(false);
                        if (date) {
                            const newDate = new Date(startDate);
                            newDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                            setStartDate(newDate);
                        }
                    }}
                />
            )}

            {showStartTimePicker && (
                <DateTimePicker
                    value={startDate}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, date) => {
                        setShowStartTimePicker(false);
                        if (date) setStartDate(date);
                    }}
                />
            )}

            {showEndDatePicker && (
                <DateTimePicker
                    value={endDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, date) => {
                        setShowEndDatePicker(false);
                        if (date) {
                            const newDate = new Date(endDate);
                            newDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                            setEndDate(newDate);
                        }
                    }}
                />
            )}

            {showEndTimePicker && (
                <DateTimePicker
                    value={endDate}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, date) => {
                        setShowEndTimePicker(false);
                        if (date) setEndDate(date);
                    }}
                />
            )}
        </SafeAreaView>
    );
}
