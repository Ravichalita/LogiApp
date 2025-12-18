import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import {
    ArrowLeft,
    Search,
    X,
    Calendar,
    Container,
    Truck,
    User,
    Filter,
    ChevronDown
} from 'lucide-react-native';
import { doc, getDoc, collection, getDocs, Timestamp } from 'firebase/firestore';
import { format, isAfter, isBefore, startOfDay, endOfDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import DateTimePicker from '@react-native-community/datetimepicker';

import { getFirebase } from '../../lib/firebase';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';

interface SearchResult {
    id: string;
    type: 'rental' | 'operation' | 'client';
    title: string;
    subtitle: string;
    status?: string;
    date?: Date;
    value?: number;
}

// Helper to parse Firestore dates
const parseFirestoreDate = (date: any): Date => {
    if (!date) return new Date();
    if (date instanceof Timestamp) return date.toDate();
    if (date.toDate && typeof date.toDate === 'function') return date.toDate();
    if (date.seconds) return new Date(date.seconds * 1000);
    if (typeof date === 'string') return new Date(date);
    if (date instanceof Date) return date;
    return new Date();
};

export default function AdvancedSearchScreen() {
    const router = useRouter();
    const { auth, db } = getFirebase();

    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [accountId, setAccountId] = useState<string>('');

    // Filter states
    const [typeFilter, setTypeFilter] = useState<'all' | 'rental' | 'operation' | 'client'>('all');
    const [showFilters, setShowFilters] = useState(false);
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [endDate, setEndDate] = useState<Date | null>(null);
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);

    useEffect(() => {
        const loadAccountId = async () => {
            if (!auth.currentUser) return;
            const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
            if (userDoc.exists()) {
                setAccountId(userDoc.data().accountId);
            }
        };
        loadAccountId();
    }, []);

    const search = async () => {
        if (!accountId || searchTerm.length < 2) {
            setResults([]);
            return;
        }

        setLoading(true);
        const searchResults: SearchResult[] = [];
        const lowerTerm = searchTerm.toLowerCase();

        try {
            // Search rentals
            if (typeFilter === 'all' || typeFilter === 'rental') {
                const rentalsSnap = await getDocs(collection(db, `accounts/${accountId}/rentals`));
                rentalsSnap.docs.forEach(docSnap => {
                    const d = docSnap.data();
                    const clientName = d.client?.name || '';
                    const address = d.deliveryAddress || '';
                    const code = `al${d.sequentialId}`;

                    const matches = code.includes(lowerTerm) ||
                        clientName.toLowerCase().includes(lowerTerm) ||
                        address.toLowerCase().includes(lowerTerm);

                    if (matches) {
                        const rentalDate = parseFirestoreDate(d.rentalDate);

                        // Apply date filters
                        if (startDate && isBefore(rentalDate, startOfDay(startDate))) return;
                        if (endDate && isAfter(rentalDate, endOfDay(endDate))) return;

                        searchResults.push({
                            id: docSnap.id,
                            type: 'rental',
                            title: `AL${d.sequentialId} - ${clientName}`,
                            subtitle: address,
                            status: d.status || 'Pendente',
                            date: rentalDate,
                            value: d.value
                        });
                    }
                });
            }

            // Search operations
            if (typeFilter === 'all' || typeFilter === 'operation') {
                const operationsSnap = await getDocs(collection(db, `accounts/${accountId}/operations`));
                operationsSnap.docs.forEach(docSnap => {
                    const d = docSnap.data();
                    const clientName = d.client?.name || '';
                    const address = d.destinationAddress || '';
                    const code = `op${d.sequentialId}`;

                    const matches = code.includes(lowerTerm) ||
                        clientName.toLowerCase().includes(lowerTerm) ||
                        address.toLowerCase().includes(lowerTerm);

                    if (matches) {
                        const opDate = parseFirestoreDate(d.startDate);

                        // Apply date filters
                        if (startDate && isBefore(opDate, startOfDay(startDate))) return;
                        if (endDate && isAfter(opDate, endOfDay(endDate))) return;

                        searchResults.push({
                            id: docSnap.id,
                            type: 'operation',
                            title: `OP${d.sequentialId} - ${clientName}`,
                            subtitle: address,
                            status: d.status || 'Pendente',
                            date: opDate,
                            value: d.value
                        });
                    }
                });
            }

            // Search clients
            if (typeFilter === 'all' || typeFilter === 'client') {
                const clientsSnap = await getDocs(collection(db, `accounts/${accountId}/clients`));
                clientsSnap.docs.forEach(docSnap => {
                    const d = docSnap.data();
                    const name = d.name || '';
                    const phone = d.phone || '';
                    const cpfCnpj = d.cpfCnpj || '';

                    const matches = name.toLowerCase().includes(lowerTerm) ||
                        phone.includes(lowerTerm) ||
                        cpfCnpj.includes(lowerTerm);

                    if (matches) {
                        searchResults.push({
                            id: docSnap.id,
                            type: 'client',
                            title: name,
                            subtitle: phone || cpfCnpj || 'Sem contato'
                        });
                    }
                });
            }

            // Sort by date (most recent first)
            searchResults.sort((a, b) => {
                if (a.date && b.date) return b.date.getTime() - a.date.getTime();
                if (a.date) return -1;
                if (b.date) return 1;
                return 0;
            });

            setResults(searchResults);
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchTerm.length >= 2) search();
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm, typeFilter, startDate, endDate]);

    const getResultIcon = (type: string) => {
        switch (type) {
            case 'rental': return <Container size={20} color="#FF9500" />;
            case 'operation': return <Truck size={20} color="#3B82F6" />;
            case 'client': return <User size={20} color="#8B5CF6" />;
            default: return null;
        }
    };

    const getResultBg = (type: string) => {
        switch (type) {
            case 'rental': return 'bg-orange-100';
            case 'operation': return 'bg-blue-100';
            case 'client': return 'bg-purple-100';
            default: return 'bg-gray-100';
        }
    };

    const handleResultPress = (result: SearchResult) => {
        if (result.type === 'client') {
            router.push({ pathname: '/clients/[id]', params: { id: result.id } });
        } else {
            router.push({ pathname: '/os/[id]', params: { id: result.id, type: result.type } });
        }
    };

    const clearFilters = () => {
        setTypeFilter('all');
        setStartDate(null);
        setEndDate(null);
    };

    const hasActiveFilters = typeFilter !== 'all' || startDate || endDate;

    return (
        <SafeAreaView className="flex-1 bg-gray-50" edges={['bottom']}>
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Busca Avançada',
                    headerLeft: () => (
                        <TouchableOpacity onPress={() => router.back()} className="mr-2">
                            <ArrowLeft size={24} color="#171717" />
                        </TouchableOpacity>
                    ),
                }}
            />

            <View className="px-4 pt-4 bg-white border-b border-gray-200">
                {/* Search Input */}
                <View className="flex-row items-center bg-gray-100 rounded-xl px-4 py-3">
                    <Search size={20} color="#9CA3AF" />
                    <TextInput
                        className="flex-1 ml-3 text-base"
                        placeholder="Buscar OS, cliente, endereço..."
                        value={searchTerm}
                        onChangeText={setSearchTerm}
                        placeholderTextColor="#9CA3AF"
                        autoFocus
                    />
                    {searchTerm.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchTerm('')}>
                            <X size={20} color="#9CA3AF" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Filter Toggle */}
                <TouchableOpacity
                    className="flex-row items-center justify-between py-3"
                    onPress={() => setShowFilters(!showFilters)}
                >
                    <View className="flex-row items-center">
                        <Filter size={18} color={hasActiveFilters ? '#FF9500' : '#6B7280'} />
                        <Text className={`ml-2 ${hasActiveFilters ? 'text-orange-500 font-medium' : 'text-gray-600'}`}>
                            Filtros {hasActiveFilters && '(ativos)'}
                        </Text>
                    </View>
                    <ChevronDown size={18} color="#6B7280" style={{ transform: [{ rotate: showFilters ? '180deg' : '0deg' }] }} />
                </TouchableOpacity>

                {/* Filters Panel */}
                {showFilters && (
                    <View className="pb-4">
                        {/* Type Filter */}
                        <Text className="text-gray-500 text-xs uppercase mb-2">Tipo</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                            {[
                                { key: 'all', label: 'Todos' },
                                { key: 'rental', label: 'Aluguéis' },
                                { key: 'operation', label: 'Operações' },
                                { key: 'client', label: 'Clientes' },
                            ].map(item => (
                                <TouchableOpacity
                                    key={item.key}
                                    className={`px-4 py-2 rounded-full mr-2 ${typeFilter === item.key ? 'bg-orange-500' : 'bg-gray-100'
                                        }`}
                                    onPress={() => setTypeFilter(item.key as any)}
                                >
                                    <Text className={typeFilter === item.key ? 'text-white' : 'text-gray-700'}>
                                        {item.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {/* Date Filter */}
                        <Text className="text-gray-500 text-xs uppercase mb-2">Período</Text>
                        <View className="flex-row gap-3">
                            <TouchableOpacity
                                className="flex-1 bg-gray-100 rounded-lg px-3 py-3 flex-row items-center justify-between"
                                onPress={() => setShowStartPicker(true)}
                            >
                                <Text className={startDate ? 'text-gray-900' : 'text-gray-400'}>
                                    {startDate ? format(startDate, 'dd/MM/yyyy') : 'Data inicial'}
                                </Text>
                                <Calendar size={16} color="#9CA3AF" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="flex-1 bg-gray-100 rounded-lg px-3 py-3 flex-row items-center justify-between"
                                onPress={() => setShowEndPicker(true)}
                            >
                                <Text className={endDate ? 'text-gray-900' : 'text-gray-400'}>
                                    {endDate ? format(endDate, 'dd/MM/yyyy') : 'Data final'}
                                </Text>
                                <Calendar size={16} color="#9CA3AF" />
                            </TouchableOpacity>
                        </View>

                        {/* Clear Filters */}
                        {hasActiveFilters && (
                            <TouchableOpacity
                                className="mt-4 items-center"
                                onPress={clearFilters}
                            >
                                <Text className="text-orange-500 font-medium">Limpar Filtros</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </View>

            {/* Date Pickers */}
            {showStartPicker && (
                <DateTimePicker
                    value={startDate || new Date()}
                    mode="date"
                    display="default"
                    onChange={(event, date) => {
                        setShowStartPicker(false);
                        if (date) setStartDate(date);
                    }}
                />
            )}
            {showEndPicker && (
                <DateTimePicker
                    value={endDate || new Date()}
                    mode="date"
                    display="default"
                    onChange={(event, date) => {
                        setShowEndPicker(false);
                        if (date) setEndDate(date);
                    }}
                />
            )}

            {/* Results */}
            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#FF9500" />
                </View>
            ) : (
                <FlatList
                    data={results}
                    keyExtractor={(item) => `${item.type}-${item.id}`}
                    contentContainerStyle={{ padding: 16 }}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            onPress={() => handleResultPress(item)}
                            className="bg-white rounded-xl p-4 mb-3 border border-gray-100"
                        >
                            <View className="flex-row items-center">
                                <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${getResultBg(item.type)}`}>
                                    {getResultIcon(item.type)}
                                </View>
                                <View className="flex-1">
                                    <Text className="font-semibold text-gray-900">{item.title}</Text>
                                    <Text className="text-gray-500 text-sm" numberOfLines={1}>{item.subtitle}</Text>
                                    {item.date && (
                                        <Text className="text-gray-400 text-xs mt-1">
                                            {format(item.date, "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                                        </Text>
                                    )}
                                </View>
                                {item.status && (
                                    <Badge variant={
                                        item.status === 'Finalizado' || item.status === 'Concluído' ? 'default' :
                                            item.status === 'Ativo' || item.status === 'Em Andamento' ? 'secondary' : 'outline'
                                    }>
                                        {item.status}
                                    </Badge>
                                )}
                            </View>
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                        <View className="items-center py-12">
                            <Search size={48} color="#D1D5DB" />
                            <Text className="text-gray-500 mt-4 text-center">
                                {searchTerm.length < 2
                                    ? 'Digite pelo menos 2 caracteres para buscar'
                                    : 'Nenhum resultado encontrado'}
                            </Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}
