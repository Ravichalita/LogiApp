import { useRef, useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, Platform, KeyboardAvoidingView } from 'react-native';
import { useRouter } from 'expo-router';
import { Calendar, Clock, MapPin, Briefcase, Plus, Save, DollarSign, Truck as TruckIcon, User, AlertTriangle } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getClients, getTrucks, getTeam, getOperationTypes, getAccount, getPopulatedOperations, getPopulatedRentals } from '../../lib/data';
import { createOperationAction } from '../../lib/actions';
import { useAuth } from '../../context/auth';
import { ClientPicker } from '../../components/ui/client-picker';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Client, OperationType, Truck, UserAccount, Account, CreateOperationData, AdditionalCost, Operation, Rental, PopulatedOperation, PopulatedRental } from '../../lib/types';
import { CostsDialog } from '../../components/costs-dialog';
import { OperationTypePicker } from '../../components/ui/operation-type-picker';

type DateMode = 'date' | 'time';

export default function NewOperation() {
    const { user } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Data State
    const [clients, setClients] = useState<Client[]>([]);
    const [team, setTeam] = useState<UserAccount[]>([]);
    const [trucks, setTrucks] = useState<Truck[]>([]);
    const [operationTypes, setOperationTypes] = useState<OperationType[]>([]);
    const [account, setAccount] = useState<Account | null>(null);
    const [existingOperations, setExistingOperations] = useState<PopulatedOperation[]>([]);
    const [existingRentals, setExistingRentals] = useState<PopulatedRental[]>([]);

    // Form State
    const [selectedClientId, setSelectedClientId] = useState<string | undefined>();
    const [selectedDriverId, setSelectedDriverId] = useState<string | undefined>(user?.uid);
    const [selectedTruckId, setSelectedTruckId] = useState<string | undefined>();
    const [selectedTypeIds, setSelectedTypeIds] = useState<string[]>([]);

    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(new Date(new Date().setHours(new Date().getHours() + 1))); // Default 1 hour later

    // Address State
    const [startAddress, setStartAddress] = useState('');
    const [destinationAddress, setDestinationAddress] = useState('');
    const [observations, setObservations] = useState('');

    // Costs State
    const [value, setValue] = useState('');
    const [travelCost, setTravelCost] = useState('');
    const [additionalCosts, setAdditionalCosts] = useState<AdditionalCost[]>([]);

    // UI State
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);
    const [dateMode, setDateMode] = useState<DateMode>('date');

    const [scheduleConflict, setScheduleConflict] = useState<string | null>(null);

    // Initial Data Fetch
    useEffect(() => {
        if (!user?.accountId) return;
        const accountId = user.accountId;

        setLoading(true);
        const unsubClients = getClients(accountId, setClients);
        const unsubTrucks = getTrucks(accountId, setTrucks);
        const unsubTeam = getTeam(accountId, setTeam);
        const unsubOps = getPopulatedOperations(accountId, setExistingOperations, (err) => console.log(err));
        const unsubRentals = getPopulatedRentals(accountId, setExistingRentals, (err) => console.log(err));

        getOperationTypes(accountId).then(setOperationTypes);
        getAccount(accountId).then(acc => {
            setAccount(acc);
            if (acc?.bases?.[0]?.address) {
                setStartAddress(acc.bases[0].address);
            }
        });

        // Set loader off after a minimal timeout to ensure transitions are smooth, 
        // though logic depends on async calls. 
        setLoading(false);

        return () => {
            unsubClients();
            unsubTrucks();
            unsubTeam();
            unsubOps();
            unsubRentals();
        };
    }, [user?.accountId]);

    // Client Classification Logic
    const classifiedClients = useMemo(() => {
        if (!clients.length) return undefined;

        const activeClients = new Set<string>();
        const completedClients = new Set<string>();

        existingOperations.forEach(op => {
            if (op.status === 'Pendente' || op.status === 'Em Andamento') {
                if (op.client) activeClients.add(op.client.id);
            } else if (op.status === 'Concluído') {
                if (op.client) completedClients.add(op.client.id);
            }
        });

        existingRentals.forEach(r => {
            if (r.status === 'Pendente' || r.status === 'Ativo' || r.status === 'Atrasado') {
                if (r.client) activeClients.add(r.client.id);
            } else if (r.status === 'Finalizado') {
                if (r.client) completedClients.add(r.client.id);
            }
        });

        const newClientsList: Client[] = [];
        const activeClientsList: Client[] = [];
        const completedClientsList: Client[] = [];
        const unservedClientsList: Client[] = [];

        clients.forEach(client => {
            if (activeClients.has(client.id)) {
                activeClientsList.push(client);
            } else if (completedClients.has(client.id)) {
                completedClientsList.push(client);
            } else {
                // Simple logic for "New": created in last 30 days? 
                // Or just if never served? 
                // Web App logic: "New" if created recently and 0 services. 
                // Here let's simplify: If not in active/completed, it's Unserved or New.
                // We'll put all others in "Não Atendidos" for simplicity or check creation date for "New".
                const isRecent = new Date().getTime() - new Date(client.createdAt?.seconds * 1000 || 0).getTime() < 30 * 24 * 60 * 60 * 1000;
                if (isRecent) newClientsList.push(client);
                else unservedClientsList.push(client);
            }
        });

        return {
            newClients: newClientsList,
            activeClients: activeClientsList,
            completedClients: completedClientsList,
            unservedClients: unservedClientsList
        };
    }, [clients, existingOperations, existingRentals]);

    // Conflict Detection
    useEffect(() => {
        if (!selectedTruckId) {
            setScheduleConflict(null);
            return;
        }

        const hasConflict = existingOperations.some(op => {
            if (op.truck?.id !== selectedTruckId || op.status === 'Concluído') return false;

            // Check date overlap
            const opStart = new Date(op.startDate).getTime();
            const opEnd = new Date(op.endDate).getTime();
            const newStart = startDate.getTime();
            const newEnd = endDate.getTime();

            return (newStart < opEnd && newEnd > opStart);
        });

        if (hasConflict) {
            setScheduleConflict('Este caminhão já possui uma operação agendada neste horário.');
        } else {
            setScheduleConflict(null);
        }

    }, [selectedTruckId, startDate, endDate, existingOperations]);


    // Handlers
    const onStartDateChange = (event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') setShowStartPicker(false);
        if (selectedDate) {
            setStartDate(selectedDate);
            // Auto update End Date if it becomes before Start Date
            if (endDate <= selectedDate) {
                const newEnd = new Date(selectedDate);
                newEnd.setHours(newEnd.getHours() + 1);
                setEndDate(newEnd);
            }
        }
    };

    const onEndDateChange = (event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') setShowEndPicker(false);
        if (selectedDate) {
            setEndDate(selectedDate);
        }
    };

    const handleCreate = async () => {
        if (!user?.accountId || !selectedClientId || !selectedDriverId || selectedTypeIds.length === 0) {
            Alert.alert('Erro', 'Por favor, preencha todos os campos obrigatórios.');
            return;
        }

        if (endDate <= startDate) {
            Alert.alert('Erro', 'A data de término deve ser posterior ao início.');
            return;
        }

        setIsSubmitting(true);

        const data: CreateOperationData = {
            clientId: selectedClientId,
            driverId: selectedDriverId,
            truckId: selectedTruckId,
            typeIds: selectedTypeIds,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            startAddress,
            destinationAddress,
            observations,
            status: 'Pendente',
            value: value ? parseFloat(value.replace(',', '.')) : 0,
            travelCost: travelCost ? parseFloat(travelCost.replace(',', '.')) : 0,
            additionalCosts,
            billingType: 'perService',
            startLatitude: null,
            startLongitude: null,
            destinationLatitude: null,
            destinationLongitude: null,
            // Location data is skipped as we don't have geocoding on mobile yet
        };

        const result = await createOperationAction(user.accountId, user.uid, data);

        setIsSubmitting(false);

        if (result.success) {
            Alert.alert('Sucesso', 'Operação criada com sucesso!', [
                { text: 'OK', onPress: () => router.back() }
            ]);
        } else {
            Alert.alert('Erro', result.error || 'Falha ao criar operação.');
        }
    };

    const openStartPicker = (mode: DateMode) => {
        setDateMode(mode);
        setShowStartPicker(true);
    };

    const openEndPicker = (mode: DateMode) => {
        setDateMode(mode);
        setShowEndPicker(true);
    };

    const formatCurrency = (value: number) => {
        return 'R$ ' + value.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    const totalValue = (value ? parseFloat(value.replace(',', '.')) : 0)
        + (travelCost ? parseFloat(travelCost.replace(',', '.')) : 0)
        + additionalCosts.reduce((acc, c) => acc + c.value, 0);

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center bg-gray-50">
                <ActivityIndicator size="large" color="#FF9500" />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-gray-50">
            {/* Header */}
            <View className="bg-white border-b border-gray-200 px-4 py-3 flex-row items-center justify-between pt-12">
                <TouchableOpacity onPress={() => router.back()}>
                    <Text className="text-orange-500 font-medium">Cancelar</Text>
                </TouchableOpacity>
                <Text className="text-lg font-headline font-bold text-gray-900">Nova Operação</Text>
                <TouchableOpacity onPress={handleCreate} disabled={isSubmitting}>
                    {isSubmitting ? (
                        <ActivityIndicator size="small" color="#FF9500" />
                    ) : (
                        <Text className="text-orange-500 font-bold">Salvar</Text>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 px-4 py-6" contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

                {/* Cliente */}
                <View className="mb-6">
                    <Text className="text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Cliente *</Text>
                    <ClientPicker
                        clients={clients}
                        classifiedClients={classifiedClients}
                        selectedClientId={selectedClientId}
                        onSelect={setSelectedClientId}
                    />
                </View>

                {/* Tipo de Operação */}
                <View className="mb-6">
                    <Text className="text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Tipo de Operação *</Text>
                    <OperationTypePicker
                        operationTypes={operationTypes}
                        selectedIds={selectedTypeIds}
                        onSelectionChange={setSelectedTypeIds}
                    />
                </View>

                {/* Datas */}
                <View className="mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <Text className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Agendamento</Text>

                    <View className="flex-row justify-between mb-4">
                        <View className="flex-1 mr-2">
                            <Text className="text-xs text-gray-500 mb-1">Início</Text>
                            <View className="flex-row">
                                <TouchableOpacity onPress={() => openStartPicker('date')} className="bg-gray-50 p-2 rounded-l-lg border border-gray-300 flex-1 items-center justify-center">
                                    <Text className="text-gray-900 font-medium">{format(startDate, 'dd/MM/yyyy')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => openStartPicker('time')} className="bg-gray-50 p-2 rounded-r-lg border-t border-b border-r border-gray-300 items-center justify-center w-20">
                                    <Text className="text-gray-900 font-medium">{format(startDate, 'HH:mm')}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                        <View className="flex-1 ml-2">
                            <Text className="text-xs text-gray-500 mb-1">Fim</Text>
                            <View className="flex-row">
                                <TouchableOpacity onPress={() => openEndPicker('date')} className="bg-gray-50 p-2 rounded-l-lg border border-gray-300 flex-1 items-center justify-center">
                                    <Text className="text-gray-900 font-medium">{format(endDate, 'dd/MM/yyyy')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => openEndPicker('time')} className="bg-gray-50 p-2 rounded-r-lg border-t border-b border-r border-gray-300 items-center justify-center w-20">
                                    <Text className="text-gray-900 font-medium">{format(endDate, 'HH:mm')}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    {/* Caminhão e Motorista */}
                    <View className="space-y-3">
                        <View className="flex-row items-center border border-gray-300 rounded-lg bg-gray-50">
                            <View className="p-3 border-r border-gray-300">
                                <TruckIcon size={20} color="#6B7280" />
                            </View>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1">
                                <View className="flex-row p-1">
                                    {trucks.map(truck => (
                                        <TouchableOpacity
                                            key={truck.id}
                                            onPress={() => setSelectedTruckId(truck.id === selectedTruckId ? undefined : truck.id)}
                                            className={`px-3 py-2 rounded-md mr-2 ${selectedTruckId === truck.id ? 'bg-orange-500' : 'bg-gray-200'}`}
                                        >
                                            <Text className={`${selectedTruckId === truck.id ? 'text-white' : 'text-gray-700'} font-medium`}>
                                                {truck.name}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </ScrollView>
                        </View>

                        {scheduleConflict && (
                            <View className="flex-row items-center bg-red-50 p-2 rounded-lg border border-red-200">
                                <AlertTriangle size={16} color="#EF4444" />
                                <Text className="text-red-600 text-xs ml-2 flex-1">{scheduleConflict}</Text>
                            </View>
                        )}

                        <View className="flex-row items-center border border-gray-300 rounded-lg bg-gray-50">
                            <View className="p-3 border-r border-gray-300">
                                <Briefcase size={20} color="#6B7280" />
                            </View>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1">
                                <View className="flex-row p-1">
                                    {team.map(member => (
                                        <TouchableOpacity
                                            key={member.id}
                                            onPress={() => setSelectedDriverId(member.id)}
                                            className={`px-3 py-2 rounded-md mr-2 ${selectedDriverId === member.id ? 'bg-blue-500' : 'bg-gray-200'}`}
                                        >
                                            <Text className={`${selectedDriverId === member.id ? 'text-white' : 'text-gray-700'} font-medium`}>
                                                {member.name.split(' ')[0]}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </ScrollView>
                        </View>
                    </View>
                </View>

                {/* Endereços */}
                <View className="mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
                    <Text className="text-sm font-bold text-gray-700 mb-1 uppercase tracking-wide">Rota</Text>

                    <View className="flex-row items-start">
                        <MapPin size={20} color="#6B7280" style={{ marginTop: 10 }} />
                        <View className="flex-1 ml-3 space-y-3">
                            <View>
                                <Text className="text-xs text-gray-500 mb-1">Origem</Text>
                                <TextInput
                                    value={startAddress}
                                    onChangeText={setStartAddress}
                                    placeholder="Endereço de saída"
                                    className="bg-gray-50 border border-gray-300 rounded-lg p-3 text-gray-900"
                                    multiline
                                />
                            </View>
                            <View>
                                <Text className="text-xs text-gray-500 mb-1">Destino</Text>
                                <TextInput
                                    value={destinationAddress}
                                    onChangeText={setDestinationAddress}
                                    placeholder="Endereço de destino"
                                    className="bg-gray-50 border border-gray-300 rounded-lg p-3 text-gray-900"
                                    multiline
                                />
                            </View>
                        </View>
                    </View>
                </View>

                {/* Valores */}
                <View className="mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4">
                    <Text className="text-sm font-bold text-gray-700 mb-1 uppercase tracking-wide">Financeiro</Text>

                    <View className="flex-row gap-4">
                        <View className="flex-1">
                            <Text className="text-xs text-gray-500 mb-1">Valor do Serviço (R$)</Text>
                            <TextInput
                                value={value}
                                onChangeText={setValue} // TODO: Add currency mask
                                placeholder="0,00"
                                keyboardType="numeric"
                                className="bg-gray-50 border border-gray-300 rounded-lg p-3 text-gray-900 font-bold"
                            />
                        </View>
                        <View className="flex-1">
                            <Text className="text-xs text-gray-500 mb-1">Custo Deslocamento (R$)</Text>
                            <TextInput
                                value={travelCost}
                                onChangeText={setTravelCost}
                                placeholder="0,00"
                                keyboardType="numeric"
                                className="bg-gray-50 border border-gray-300 rounded-lg p-3 text-gray-900"
                            />
                        </View>
                    </View>

                    <CostsDialog costs={additionalCosts} onSave={setAdditionalCosts}>
                        <View className="flex-row items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
                            <View className="flex-row items-center">
                                <DollarSign size={20} color="#F97316" />
                                <Text className="ml-2 text-orange-700 font-medium">Custos Adicionais</Text>
                            </View>
                            <View className="flex-row items-center">
                                <Text className="text-orange-700 font-bold mr-2">
                                    {additionalCosts.reduce((acc, c) => acc + c.value, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </Text>
                                <Plus size={16} color="#F97316" />
                            </View>
                        </View>
                    </CostsDialog>

                    <View className="pt-3 border-t border-gray-100 flex-row justify-between items-center">
                        <Text className="text-gray-600 font-medium">Total Estimado</Text>
                        <Text className="text-xl font-bold text-gray-900">
                            {formatCurrency(totalValue)}
                        </Text>
                    </View>
                </View>

                {/* Observações */}
                <View className="mb-24">
                    <Text className="text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Observações</Text>
                    <TextInput
                        value={observations}
                        onChangeText={setObservations}
                        placeholder="Instruções adicionais..."
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                        className="bg-white border border-gray-300 rounded-lg p-3 text-gray-900 h-32"
                    />
                </View>

            </ScrollView>

            {/* DateTime Pickers */}
            {(showStartPicker || showEndPicker) && (
                <DateTimePicker
                    value={showStartPicker ? startDate : endDate}
                    mode={dateMode}
                    is24Hour={true}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={showStartPicker ? onStartDateChange : onEndDateChange}
                />
            )}
        </KeyboardAvoidingView>
    );
}
