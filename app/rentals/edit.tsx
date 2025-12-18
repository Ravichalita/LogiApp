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
import { ChevronLeft, Calendar, MapPin, DollarSign, FileText } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { doc, getDoc } from 'firebase/firestore';

import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { ClientPicker } from '../../components/ui/client-picker';
import { DumpsterPicker } from '../../components/ui/dumpster-picker';

import { getFirebase } from '../../lib/firebase';
import { getClients, getDumpsters } from '../../lib/data';
import { updateRentalAction, UpdateRentalData } from '../../lib/actions';
import { Client, Dumpster } from '../../lib/types';

export default function EditRentalScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { auth, db } = getFirebase();

    // Data states
    const [clients, setClients] = useState<Client[]>([]);
    const [dumpsters, setDumpsters] = useState<Dumpster[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [loadingRental, setLoadingRental] = useState(true);

    // Form states
    const [selectedClientId, setSelectedClientId] = useState<string>();
    const [selectedDumpsterIds, setSelectedDumpsterIds] = useState<string[]>([]);
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [rentalDate, setRentalDate] = useState(new Date());
    const [returnDate, setReturnDate] = useState(new Date());
    const [value, setValue] = useState('');
    const [observations, setObservations] = useState('');

    // UI states
    const [showRentalDatePicker, setShowRentalDatePicker] = useState(false);
    const [showReturnDatePicker, setShowReturnDatePicker] = useState(false);
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

    // Load rental data
    useEffect(() => {
        if (!accountId || !id) return;

        const loadRental = async () => {
            try {
                const rentalRef = doc(db, `accounts/${accountId}/rentals`, id);
                const rentalSnap = await getDoc(rentalRef);

                if (rentalSnap.exists()) {
                    const data = rentalSnap.data();
                    setSelectedClientId(data.clientId);
                    setSelectedDumpsterIds(data.dumpsterIds || []);
                    setDeliveryAddress(data.deliveryAddress || '');
                    setRentalDate(new Date(data.rentalDate));
                    setReturnDate(new Date(data.returnDate));
                    setValue(data.value?.toFixed(2).replace('.', ',') || '0,00');
                    setObservations(data.observations || '');
                }
            } catch (error) {
                console.error('Error loading rental:', error);
                Alert.alert('Erro', 'Falha ao carregar dados do aluguel.');
            } finally {
                setLoadingRental(false);
            }
        };

        loadRental();
    }, [accountId, id]);

    // Load clients and dumpsters
    useEffect(() => {
        if (!accountId) return;

        const unsubClients = getClients(accountId, (data) => {
            setClients(data);
        });

        const unsubDumpsters = getDumpsters(accountId, (data) => {
            setDumpsters(data);
            setLoadingData(false);
        });

        return () => {
            unsubClients();
            unsubDumpsters();
        };
    }, [accountId]);

    const handleSubmit = async () => {
        if (selectedDumpsterIds.length === 0) {
            Alert.alert('Erro', 'Selecione pelo menos uma caçamba.');
            return;
        }
        if (!selectedClientId) {
            Alert.alert('Erro', 'Selecione um cliente.');
            return;
        }
        if (!deliveryAddress.trim()) {
            Alert.alert('Erro', 'Informe o endereço de entrega.');
            return;
        }

        const numericValue = parseFloat(value.replace(',', '.')) || 0;

        setSubmitting(true);

        try {
            const data: UpdateRentalData = {
                dumpsterIds: selectedDumpsterIds,
                clientId: selectedClientId,
                rentalDate: rentalDate.toISOString(),
                returnDate: returnDate.toISOString(),
                deliveryAddress: deliveryAddress.trim(),
                value: numericValue,
                observations: observations.trim(),
            };

            const result = await updateRentalAction(accountId, id, data);

            if (result.success) {
                Alert.alert('Sucesso', 'Aluguel atualizado com sucesso!', [
                    { text: 'OK', onPress: () => router.back() }
                ]);
            } else {
                Alert.alert('Erro', result.error || 'Falha ao atualizar aluguel.');
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Erro', 'Ocorreu um erro ao atualizar o aluguel.');
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

    if (loadingRental) {
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
                    title: 'Editar Aluguel',
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
                    {/* Caçamba Selection */}
                    <Card className="mb-4">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Caçamba(s)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <DumpsterPicker
                                dumpsters={dumpsters}
                                selectedIds={selectedDumpsterIds}
                                onSelectionChange={setSelectedDumpsterIds}
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

                    {/* Dates */}
                    <Card className="mb-4">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex-row items-center">
                                <Calendar size={16} color="#FF9500" />
                                <Text className="ml-2 text-base font-semibold">Período</Text>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <View className="flex-row gap-4">
                                <View className="flex-1">
                                    <Label>Data de Entrega</Label>
                                    <TouchableOpacity
                                        onPress={() => setShowRentalDatePicker(true)}
                                        className="border border-gray-300 rounded-lg p-3 bg-white mt-1"
                                    >
                                        <Text className="text-gray-900">
                                            {format(rentalDate, 'dd/MM/yyyy', { locale: ptBR })}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                                <View className="flex-1">
                                    <Label>Data de Retirada</Label>
                                    <TouchableOpacity
                                        onPress={() => setShowReturnDatePicker(true)}
                                        className="border border-gray-300 rounded-lg p-3 bg-white mt-1"
                                    >
                                        <Text className="text-gray-900">
                                            {format(returnDate, 'dd/MM/yyyy', { locale: ptBR })}
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
                                <Text className="ml-2 text-base font-semibold">Endereço de Entrega</Text>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Input
                                placeholder="Endereço completo"
                                value={deliveryAddress}
                                onChangeText={setDeliveryAddress}
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
                                label="Valor por dia (R$)"
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

            {/* Date Pickers */}
            {showRentalDatePicker && (
                <DateTimePicker
                    value={rentalDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, date) => {
                        setShowRentalDatePicker(false);
                        if (date) setRentalDate(date);
                    }}
                />
            )}

            {showReturnDatePicker && (
                <DateTimePicker
                    value={returnDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, date) => {
                        setShowReturnDatePicker(false);
                        if (date) setReturnDate(date);
                    }}
                />
            )}
        </SafeAreaView>
    );
}
