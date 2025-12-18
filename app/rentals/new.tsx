import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    Alert,
    TouchableOpacity,
    Platform,
    KeyboardAvoidingView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Calendar, MapPin, DollarSign, FileText, Truck } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { ClientPicker } from '../../components/ui/client-picker';
import { DumpsterPicker } from '../../components/ui/dumpster-picker';
import { RecurrenceSelector } from '../../components/recurrence-selector';
import { AttachmentsUploader } from '../../components/attachments-uploader';

import { getFirebase } from '../../lib/firebase';
import { getClients, getDumpsters, getTeam, getTrucks } from '../../lib/data';
import { createRentalAction, CreateRentalData } from '../../lib/actions';
import { Client, Dumpster, UserAccount, Truck as TruckType, Attachment, RecurrenceData } from '../../lib/types';

export default function NewRentalScreen() {
    const router = useRouter();
    const { auth } = getFirebase();

    // Data states
    const [clients, setClients] = useState<Client[]>([]);
    const [dumpsters, setDumpsters] = useState<Dumpster[]>([]);
    const [team, setTeam] = useState<UserAccount[]>([]);
    const [trucks, setTrucks] = useState<TruckType[]>([]);
    const [loadingData, setLoadingData] = useState(true);

    // Form states
    const [selectedClientId, setSelectedClientId] = useState<string>();
    const [selectedDumpsterIds, setSelectedDumpsterIds] = useState<string[]>([]);
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [rentalDate, setRentalDate] = useState(new Date());
    const [returnDate, setReturnDate] = useState(addDays(new Date(), 2));
    const [value, setValue] = useState('');
    const [observations, setObservations] = useState('');
    const [selectedTruckId, setSelectedTruckId] = useState<string>('');
    const [billingType, setBillingType] = useState<'perDay' | 'lumpSum'>('perDay');

    // Recurrence & Attachments
    const [recurrence, setRecurrence] = useState<RecurrenceData>({
        enabled: false,
        frequency: 'weekly',
        daysOfWeek: [],
        time: '08:00',
        billingType: 'perService',
    });
    const [attachments, setAttachments] = useState<Attachment[]>([]);

    // UI states
    const [showRentalDatePicker, setShowRentalDatePicker] = useState(false);
    const [showReturnDatePicker, setShowReturnDatePicker] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Get accountId from user claims
    const [accountId, setAccountId] = useState<string>('');

    const { cloneFromId } = useLocalSearchParams<{ cloneFromId: string }>();
    const { db } = getFirebase();

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

    // Load data
    useEffect(() => {
        if (!accountId) return;

        const unsubClients = getClients(accountId, (data) => {
            setClients(data);
        });

        const unsubDumpsters = getDumpsters(accountId, (data) => {
            setDumpsters(data);
        });

        const unsubTeam = getTeam(accountId, (data) => {
            setTeam(data);
        });

        const unsubTrucks = getTrucks(accountId, (data) => {
            setTrucks(data);
            setLoadingData(false);
        });

        return () => {
            unsubClients();
            unsubDumpsters();
            unsubTeam();
            unsubTrucks();
        };
    }, [accountId]);

    // Clone Data
    useEffect(() => {
        const loadCloneData = async () => {
            if (!accountId || !cloneFromId) return;

            try {
                const { doc, getDoc } = require('firebase/firestore');
                const docRef = doc(db, `accounts/${accountId}/rentals`, cloneFromId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setSelectedClientId(data.clientId);
                    setSelectedDumpsterIds(data.dumpsterIds || []);
                    setDeliveryAddress(data.deliveryAddress || '');
                    setValue(data.value ? data.value.toString().replace('.', ',') : '');
                    setObservations(data.observations || '');
                    setBillingType(data.billingType || 'perDay');
                    // Keep dates as default (new rental)
                }
            } catch (error) {
                console.error("Error cloning rental:", error);
                Alert.alert("Erro", "Falha ao copiar dados do aluguel anterior.");
            }
        };

        loadCloneData();
    }, [accountId, cloneFromId]);

    // Auto-fill address from selected client (only if not cloning or if address is empty)
    useEffect(() => {
        if (selectedClientId && !cloneFromId) {
            const client = clients.find(c => c.id === selectedClientId);
            if (client?.address && !deliveryAddress) {
                setDeliveryAddress(client.address);
            }
        }
    }, [selectedClientId, clients, cloneFromId]);

    const handleSubmit = async () => {
        // Validation
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
            const data: CreateRentalData = {
                dumpsterIds: selectedDumpsterIds,
                clientId: selectedClientId,
                assignedTo: auth.currentUser?.uid || '',
                truckId: selectedTruckId || undefined,
                rentalDate: rentalDate.toISOString(),
                returnDate: returnDate.toISOString(),
                deliveryAddress: deliveryAddress.trim(),
                value: billingType === 'perDay' ? numericValue : 0,
                lumpSumValue: billingType === 'lumpSum' ? numericValue : 0,
                billingType: billingType,
                observations: observations.trim(),
                recurrence: recurrence.enabled ? recurrence : undefined,
                attachments: attachments,
            };

            const result = await createRentalAction(accountId, auth.currentUser?.uid || '', data);

            if (result.success) {
                Alert.alert('Sucesso', 'Aluguel criado com sucesso!', [
                    { text: 'OK', onPress: () => router.back() }
                ]);
            } else {
                Alert.alert('Erro', result.error || 'Falha ao criar aluguel.');
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Erro', 'Ocorreu um erro ao criar o aluguel.');
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

    return (
        <SafeAreaView className="flex-1 bg-gray-50" edges={['bottom']}>
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Novo Aluguel',
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
                    showsVerticalScrollIndicator={false}
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

                    {/* Billing */}
                    <Card className="mb-4">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex-row items-center">
                                <DollarSign size={16} color="#FF9500" />
                                <Text className="ml-2 text-base font-semibold">Faturamento</Text>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <View>
                                <Label className="mb-2">Tipo de Cobrança</Label>
                                <View className="flex-row gap-2">
                                    <TouchableOpacity
                                        onPress={() => setBillingType('perDay')}
                                        className={`flex-1 p-3 rounded-lg border items-center ${billingType === 'perDay'
                                            ? 'bg-orange-100 border-orange-500'
                                            : 'bg-white border-gray-300'
                                            }`}
                                    >
                                        <Text className={billingType === 'perDay' ? 'text-orange-700 font-medium' : 'text-gray-700'}>
                                            Diária
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => setBillingType('lumpSum')}
                                        className={`flex-1 p-3 rounded-lg border items-center ${billingType === 'lumpSum'
                                            ? 'bg-orange-100 border-orange-500'
                                            : 'bg-white border-gray-300'
                                            }`}
                                    >
                                        <Text className={billingType === 'lumpSum' ? 'text-orange-700 font-medium' : 'text-gray-700'}>
                                            Valor Fechado
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <Input
                                label={billingType === 'perDay' ? "Valor da Diária (R$)" : "Valor Total (R$)"}
                                placeholder="0,00"
                                value={value}
                                onChangeText={(text) => setValue(formatCurrency(text))}
                                keyboardType="numeric"
                            />
                        </CardContent>
                    </Card>

                    {/* Truck (Optional) */}
                    <Card className="mb-4">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex-row items-center">
                                <Truck size={16} color="#FF9500" />
                                <Text className="ml-2 text-base font-semibold">Caminhão (Opcional)</Text>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
                                <TouchableOpacity
                                    onPress={() => setSelectedTruckId('')}
                                    className={`px-4 py-2 rounded-full border ${!selectedTruckId ? 'bg-orange-500 border-orange-500' : 'bg-white border-gray-300'
                                        }`}
                                >
                                    <Text className={!selectedTruckId ? 'text-white' : 'text-gray-700'}>Nenhum</Text>
                                </TouchableOpacity>
                                {trucks.map((truck) => (
                                    <TouchableOpacity
                                        key={truck.id}
                                        onPress={() => setSelectedTruckId(truck.id)}
                                        className={`px-4 py-2 rounded-full border ${selectedTruckId === truck.id ? 'bg-orange-500 border-orange-500' : 'bg-white border-gray-300'
                                            }`}
                                    >
                                        <Text className={selectedTruckId === truck.id ? 'text-white' : 'text-gray-700'}>
                                            {truck.plate}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </CardContent>
                    </Card>

                    {/* Recurrence */}
                    <View className="mb-4">
                        <RecurrenceSelector
                            value={recurrence}
                            onChange={setRecurrence}
                        />
                    </View>

                    {/* Attachments */}
                    {/* <Card className="mb-4">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex-row items-center">
                                <FileText size={16} color="#FF9500" />
                                <Text className="ml-2 text-base font-semibold">Anexos</Text>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <AttachmentsUploader
                                accountId={accountId}
                                attachments={attachments}
                                onChange={setAttachments}
                            />
                        </CardContent>
                    </Card> */}

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
                        Criar Aluguel
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
                        if (date) {
                            setRentalDate(date);
                            if (date > returnDate) {
                                setReturnDate(addDays(date, 2));
                            }
                        }
                    }}
                    minimumDate={new Date()}
                />
            )}

            {showReturnDatePicker && (
                <DateTimePicker
                    value={returnDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, date) => {
                        setShowReturnDatePicker(false);
                        if (date) {
                            setReturnDate(date);
                        }
                    }}
                    minimumDate={rentalDate}
                />
            )}
        </SafeAreaView>
    );
}
