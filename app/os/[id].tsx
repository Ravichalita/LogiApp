import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getFirebase } from '../../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { PopulatedRental, PopulatedOperation, Dumpster } from '../../lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { MapPin, Calendar, User, Truck, Info, Phone, ArrowLeft } from 'lucide-react-native';
import { Separator } from '../../components/ui/separator';

export default function OSDetail() {
    const { id, type } = useLocalSearchParams<{ id: string, type: 'rental' | 'operation' }>();
    const [item, setItem] = useState<PopulatedRental | PopulatedOperation | null>(null);
    const [loading, setLoading] = useState(true);
    const [accountId, setAccountId] = useState<string | null>(null);
    const router = useRouter();
    const { auth, db } = getFirebase();

    useEffect(() => {
        // Quick/Dirty fetch. In real app, refactor to data.ts helper
        const fetchItem = async () => {
            if (!auth.currentUser) return;

            try {
                // 1. Get Account ID
                const userSnap = await getDoc(doc(db, "users", auth.currentUser.uid));
                if (!userSnap.exists()) return;
                const accId = userSnap.data().accountId;
                setAccountId(accId);

                // 2. Fetch Document
                const collectionName = type === 'rental' ? 'rentals' : 'operations';
                const docRef = doc(db, `accounts/${accId}/${collectionName}`, id);
                const docSnap = await getDoc(docRef);

                if (!docSnap.exists()) {
                    Alert.alert("Erro", "OS não encontrada");
                    router.back();
                    return;
                }

                const data = docSnap.data();

                // 3. Populate (simplified for this view, mostly Client and Dumpsters/Types)
                // Fetch Client
                let clientData = null;
                if (data.clientId) {
                    const clientSnap = await getDoc(doc(db, `accounts/${accId}/clients`, data.clientId));
                    if (clientSnap.exists()) clientData = { id: clientSnap.id, ...clientSnap.data() };
                }

                // Fetch Dumpsters (if rental)
                let dumpstersData: any[] = [];
                if (type === 'rental') {
                    const dumpsterIds = data.dumpsterIds || (data.dumpsterId ? [data.dumpsterId] : []);
                    if (dumpsterIds.length > 0) {
                        const q = query(collection(db, `accounts/${accId}/dumpsters`), where('__name__', 'in', dumpsterIds.slice(0, 10))); // Limit to 10 for 'in' query safety
                        const dSnaps = await getDocs(q);
                        dumpstersData = dSnaps.docs.map(d => ({ id: d.id, ...d.data() }));
                    }
                }

                setItem({
                    id: docSnap.id,
                    ...data,
                    itemType: type,
                    client: clientData,
                    dumpsters: dumpstersData,
                    // other fields left as raw IDs or basic data for now
                } as any);

            } catch (error) {
                console.error(error);
                Alert.alert("Erro", "Falha ao carregar detalhes");
            } finally {
                setLoading(false);
            }
        };

        fetchItem();
    }, [id, type]);


    if (loading) {
        return (
            <SafeAreaView className="flex-1 items-center justify-center bg-gray-50">
                <ActivityIndicator size="large" color="#2563EB" />
            </SafeAreaView>
        );
    }

    if (!item) return null;

    const isRental = item.itemType === 'rental';
    const title = item.client?.name || "Cliente Desconhecido";
    const osId = isRental ? `AL${(item as any).sequentialId}` : `OP${(item as any).sequentialId}`;
    const dateLine = isRental
        ? `${new Date(item.rentalDate).toLocaleDateString()} - ${new Date(item.returnDate).toLocaleDateString()}`
        : `${new Date(item.startDate!).toLocaleDateString()} - ${new Date(item.endDate!).toLocaleDateString()}`;

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View className="px-4 py-3 bg-white border-b border-gray-200 flex-row items-center">
                <TouchableOpacity onPress={() => router.back()} className="mr-3">
                    <ArrowLeft size={24} color="#1F2937" />
                </TouchableOpacity>
                <View>
                    <Text className="text-lg font-bold text-gray-900">Detalhes da OS</Text>
                    <Text className="text-xs text-gray-500">{osId}</Text>
                </View>
            </View>

            <ScrollView contentContainerClassName="p-4 space-y-4">
                {/* Main Info Card */}
                <Card>
                    <CardHeader>
                        <View className="flex-row justify-between">
                            <View>
                                <CardTitle className="text-xl">{title}</CardTitle>
                                {isRental && (item as any).dumpsters?.map((d: any) => (
                                    <Text key={d.id} className="text-gray-500 text-sm mt-1">• {d.name} ({d.size}m³)</Text>
                                ))}
                            </View>
                            <Badge variant={isRental ? "secondary" : "default"}>
                                <Text className={isRental ? "text-gray-700" : "text-white"}>
                                    {isRental ? "Aluguel" : "Operação"}
                                </Text>
                            </Badge>
                        </View>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <View className="flex-row items-start gap-3">
                            <MapPin size={20} color="#4B5563" className="mt-0.5" />
                            <View className="flex-1">
                                <Text className="font-semibold text-gray-700">Endereço</Text>
                                <Text className="text-gray-600">
                                    {isRental ? (item as any).deliveryAddress : (item as any).destinationAddress}
                                </Text>
                            </View>
                        </View>

                        <View className="flex-row items-start gap-3">
                            <Calendar size={20} color="#4B5563" className="mt-0.5" />
                            <View className="flex-1">
                                <Text className="font-semibold text-gray-700">Período</Text>
                                <Text className="text-gray-600">{dateLine}</Text>
                            </View>
                        </View>

                        {item.observations && (
                            <View className="flex-row items-start gap-3">
                                <Info size={20} color="#4B5563" className="mt-0.5" />
                                <View className="flex-1">
                                    <Text className="font-semibold text-gray-700">Observações</Text>
                                    <Text className="text-gray-600">{item.observations}</Text>
                                </View>
                            </View>
                        )}
                    </CardContent>
                </Card>

                {/* Status & Value */}
                <View className="flex-row gap-4">
                    <Card className="flex-1">
                        <CardContent className="pt-4 items-center">
                            <Text className="text-gray-500 text-xs uppercase font-bold">Status</Text>
                            <Text className="text-lg font-semibold mt-1 capitalize">{(item as any).status}</Text>
                        </CardContent>
                    </Card>
                    <Card className="flex-1">
                        <CardContent className="pt-4 items-center">
                            <Text className="text-gray-500 text-xs uppercase font-bold">Valor</Text>
                            <Text className="text-lg font-semibold mt-1 text-green-600">
                                {((item as any).value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </Text>
                        </CardContent>
                    </Card>
                </View>

                {/* Actions */}
                <Button className="w-full" variant="outline" onPress={() => Alert.alert("Em breve", "Edição será implementada na próxima fase.")}>
                    Editar OS
                </Button>

                <Button className="w-full bg-red-50 text-red-600 border border-red-200" variant="ghost" onPress={() => Alert.alert("Em breve", "Exclusão será implementada na próxima fase.")}>
                    Excluir OS
                </Button>

            </ScrollView>
        </SafeAreaView>
    );
}
