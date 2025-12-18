import React, { useEffect, useState, useMemo } from 'react';
import {
    View,
    Text,
    ScrollView,
    ActivityIndicator,
    TouchableOpacity,
    Alert,
    Platform,
    Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { ChevronLeft, MapPin, Navigation, Truck, Clock, Route, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react-native';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { getFirebase } from '../../lib/firebase';
import { Rental, Operation, Client, Truck as TruckType } from '../../lib/types';

interface RouteStop {
    id: string;
    type: 'rental' | 'operation';
    sequentialId: number;
    clientName: string;
    address: string;
    latitude?: number | null;
    longitude?: number | null;
    status: string;
    dumpsterNames?: string[];
    truckName?: string;
}

export default function RoutePlanningScreen() {
    const router = useRouter();
    const { auth, db } = getFirebase();

    const [loading, setLoading] = useState(true);
    const [stops, setStops] = useState<RouteStop[]>([]);
    const [trucks, setTrucks] = useState<TruckType[]>([]);
    const [selectedTruck, setSelectedTruck] = useState<string | null>(null);
    const [showTruckPicker, setShowTruckPicker] = useState(false);
    const [accountId, setAccountId] = useState<string>('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        if (!auth.currentUser) return;

        try {
            const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
            if (!userDoc.exists()) return;

            const accId = userDoc.data().accountId;
            setAccountId(accId);

            // Load trucks
            const trucksSnap = await getDocs(collection(db, `accounts/${accId}/trucks`));
            const trucksData = trucksSnap.docs.map(d => ({ id: d.id, ...d.data() })) as TruckType[];
            setTrucks(trucksData);

            // Load clients for name mapping
            const clientsSnap = await getDocs(collection(db, `accounts/${accId}/clients`));
            const clientsMap = new Map(clientsSnap.docs.map(d => [d.id, d.data().name]));

            // Load active rentals
            const rentalsQuery = query(
                collection(db, `accounts/${accId}/rentals`),
                where('status', 'in', ['Pendente', 'Ativo'])
            );
            const rentalsSnap = await getDocs(rentalsQuery);

            // Load active operations
            const operationsQuery = query(
                collection(db, `accounts/${accId}/operations`),
                where('status', 'in', ['Pendente', 'Em Andamento'])
            );
            const operationsSnap = await getDocs(operationsQuery);

            const routeStops: RouteStop[] = [];

            rentalsSnap.docs.forEach(d => {
                const data = d.data();
                if (data.destinationLatitude && data.destinationLongitude) {
                    routeStops.push({
                        id: d.id,
                        type: 'rental',
                        sequentialId: data.sequentialId,
                        clientName: clientsMap.get(data.clientId) || 'Cliente',
                        address: data.destinationAddress || '',
                        latitude: data.destinationLatitude,
                        longitude: data.destinationLongitude,
                        status: data.status || 'Pendente',
                        dumpsterNames: data.dumpsterNames || []
                    });
                }
            });

            operationsSnap.docs.forEach(d => {
                const data = d.data();
                if (data.destinationLatitude && data.destinationLongitude) {
                    routeStops.push({
                        id: d.id,
                        type: 'operation',
                        sequentialId: data.sequentialId,
                        clientName: clientsMap.get(data.clientId) || 'Cliente',
                        address: data.destinationAddress || '',
                        latitude: data.destinationLatitude,
                        longitude: data.destinationLongitude,
                        status: data.status || 'Pendente',
                        truckName: data.truckName
                    });
                }
            });

            setStops(routeStops);
        } catch (error) {
            console.error('Error loading route data:', error);
            Alert.alert('Erro', 'Falha ao carregar dados de rotas');
        } finally {
            setLoading(false);
        }
    };

    const filteredStops = useMemo(() => {
        if (!selectedTruck) return stops;
        return stops.filter(s => s.truckName === selectedTruck);
    }, [stops, selectedTruck]);

    const mapRegion = useMemo(() => {
        if (filteredStops.length === 0) {
            return {
                latitude: -23.5505,
                longitude: -46.6333,
                latitudeDelta: 0.5,
                longitudeDelta: 0.5
            };
        }

        const lats = filteredStops.filter(s => s.latitude).map(s => s.latitude!);
        const lngs = filteredStops.filter(s => s.longitude).map(s => s.longitude!);

        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);

        return {
            latitude: (minLat + maxLat) / 2,
            longitude: (minLng + maxLng) / 2,
            latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.02),
            longitudeDelta: Math.max((maxLng - minLng) * 1.5, 0.02)
        };
    }, [filteredStops]);

    const openInMaps = (stop: RouteStop) => {
        if (!stop.latitude || !stop.longitude) return;

        const url = Platform.select({
            ios: `maps:0,0?q=${stop.address}`,
            android: `geo:${stop.latitude},${stop.longitude}?q=${stop.address}`,
        });

        if (url) Linking.openURL(url);
    };

    const openRouteInMaps = () => {
        if (filteredStops.length === 0) return;

        const waypoints = filteredStops
            .filter(s => s.latitude && s.longitude)
            .map(s => `${s.latitude},${s.longitude}`)
            .join('|');

        const origin = filteredStops[0];
        const destination = filteredStops[filteredStops.length - 1];

        if (origin.latitude && origin.longitude && destination.latitude && destination.longitude) {
            const url = `https://www.google.com/maps/dir/?api=1&origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&waypoints=${waypoints}&travelmode=driving`;
            Linking.openURL(url);
        }
    };

    const getMarkerColor = (type: 'rental' | 'operation', status: string) => {
        if (status === 'Pendente') return '#EAB308';
        if (type === 'rental') return '#F97316';
        return '#3B82F6';
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50" edges={['bottom']}>
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Planejamento de Rotas',
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
                <View className="flex-1">
                    {/* Map */}
                    <View className="h-64 bg-gray-200">
                        <MapView
                            style={{ flex: 1 }}
                            provider={PROVIDER_GOOGLE}
                            region={mapRegion}
                            showsUserLocation
                            showsTraffic
                        >
                            {filteredStops.map((stop, index) => (
                                stop.latitude && stop.longitude && (
                                    <Marker
                                        key={stop.id}
                                        coordinate={{
                                            latitude: stop.latitude,
                                            longitude: stop.longitude
                                        }}
                                        title={`${stop.type === 'rental' ? 'AL' : 'OP'}${stop.sequentialId}`}
                                        description={stop.clientName}
                                        pinColor={getMarkerColor(stop.type, stop.status)}
                                    />
                                )
                            ))}
                        </MapView>
                    </View>

                    {/* Actions Bar */}
                    <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
                        <View className="flex-row items-center">
                            <Route size={18} color="#6B7280" />
                            <Text className="text-gray-700 font-medium ml-2">
                                {filteredStops.length} paradas
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={openRouteInMaps}
                            className="flex-row items-center bg-orange-500 rounded-lg px-4 py-2"
                        >
                            <Navigation size={16} color="#FFFFFF" />
                            <Text className="text-white font-medium ml-2">Abrir Rota</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Truck Filter */}
                    <TouchableOpacity
                        onPress={() => setShowTruckPicker(!showTruckPicker)}
                        className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-gray-200"
                    >
                        <View className="flex-row items-center">
                            <Truck size={18} color="#6B7280" />
                            <Text className="text-gray-700 ml-2">
                                {selectedTruck || 'Todos os veículos'}
                            </Text>
                        </View>
                        {showTruckPicker ? (
                            <ChevronUp size={18} color="#6B7280" />
                        ) : (
                            <ChevronDown size={18} color="#6B7280" />
                        )}
                    </TouchableOpacity>

                    {showTruckPicker && (
                        <View className="bg-white border-b border-gray-200">
                            <TouchableOpacity
                                onPress={() => {
                                    setSelectedTruck(null);
                                    setShowTruckPicker(false);
                                }}
                                className={`px-6 py-3 ${!selectedTruck ? 'bg-orange-50' : ''}`}
                            >
                                <Text className={`${!selectedTruck ? 'text-orange-600 font-medium' : 'text-gray-700'}`}>
                                    Todos os veículos
                                </Text>
                            </TouchableOpacity>
                            {trucks.map(truck => (
                                <TouchableOpacity
                                    key={truck.id}
                                    onPress={() => {
                                        setSelectedTruck(truck.name);
                                        setShowTruckPicker(false);
                                    }}
                                    className={`px-6 py-3 ${selectedTruck === truck.name ? 'bg-orange-50' : ''}`}
                                >
                                    <Text className={`${selectedTruck === truck.name ? 'text-orange-600 font-medium' : 'text-gray-700'}`}>
                                        {truck.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* Stops List */}
                    <ScrollView className="flex-1 p-4">
                        {filteredStops.length === 0 ? (
                            <Card>
                                <CardContent className="py-8 items-center">
                                    <MapPin size={40} color="#D1D5DB" />
                                    <Text className="text-gray-500 mt-3">Nenhuma parada com localização</Text>
                                    <Text className="text-gray-400 text-sm mt-1">
                                        As OS precisam ter endereço com coordenadas
                                    </Text>
                                </CardContent>
                            </Card>
                        ) : (
                            <Card>
                                <CardContent className="py-0">
                                    {filteredStops.map((stop, index) => (
                                        <TouchableOpacity
                                            key={stop.id}
                                            onPress={() => openInMaps(stop)}
                                            className={`flex-row items-center py-4 ${index < filteredStops.length - 1 ? 'border-b border-gray-100' : ''}`}
                                        >
                                            <View className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${stop.type === 'rental' ? 'bg-orange-100' : 'bg-blue-100'}`}>
                                                <Text className={`font-bold text-sm ${stop.type === 'rental' ? 'text-orange-600' : 'text-blue-600'}`}>
                                                    {index + 1}
                                                </Text>
                                            </View>
                                            <View className="flex-1">
                                                <View className="flex-row items-center">
                                                    <Text className="font-medium text-gray-900">
                                                        {stop.type === 'rental' ? 'AL' : 'OP'}{stop.sequentialId}
                                                    </Text>
                                                    <Badge variant={stop.status === 'Pendente' ? 'outline' : 'default'} className="ml-2">
                                                        <Text className="text-xs">{stop.status}</Text>
                                                    </Badge>
                                                </View>
                                                <Text className="text-gray-600 text-sm">{stop.clientName}</Text>
                                                <Text className="text-gray-400 text-xs mt-1" numberOfLines={1}>
                                                    {stop.address}
                                                </Text>
                                            </View>
                                            <ExternalLink size={18} color="#9CA3AF" />
                                        </TouchableOpacity>
                                    ))}
                                </CardContent>
                            </Card>
                        )}
                        <View className="h-8" />
                    </ScrollView>
                </View>
            )}
        </SafeAreaView>
    );
}
