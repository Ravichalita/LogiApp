import { View, Text, SectionList, ActivityIndicator, FlatList, TouchableOpacity, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState, useMemo } from "react";
import { getFirebase } from "../../lib/firebase";
import { getPopulatedRentals, getPopulatedOperations, getAccount } from "../../lib/data";
import { PopulatedRental, PopulatedOperation, Account } from "../../lib/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Tabs, Stack, useRouter } from "expo-router";
import { Clock, Calendar, MapPin, User, Search, Filter } from "lucide-react-native";
import { onAuthStateChanged } from "firebase/auth";

export default function ServiceOrders() {
    const [rentals, setRentals] = useState<PopulatedRental[]>([]);
    const [operations, setOperations] = useState<PopulatedOperation[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [user, setUser] = useState<any>(null);
    const [accountId, setAccountId] = useState<string | null>(null);
    const router = useRouter();

    const { auth, db } = getFirebase();

    useEffect(() => {
        const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                const { doc, getDoc } = require("firebase/firestore");
                const userDocRef = doc(db, "users", currentUser.uid);
                const userSnap = await getDoc(userDocRef);
                if (userSnap.exists()) {
                    setAccountId(userSnap.data().accountId);
                }
            } else {
                setLoading(false);
            }
        });
        return () => unsubAuth();
    }, []);

    useEffect(() => {
        if (!accountId) return;

        setLoading(true);
        const unsubRentals = getPopulatedRentals(
            accountId,
            (data) => setRentals(data),
            (err) => console.error(err)
        );
        const unsubOps = getPopulatedOperations(
            accountId,
            (data) => setOperations(data),
            (err) => console.error(err)
        );

        setLoading(false);
        return () => {
            unsubRentals();
            unsubOps();
        };
    }, [accountId]);


    const filteredItems = useMemo(() => {
        const rentalItems = rentals.map(r => ({ ...r, itemType: 'rental' as const, sortDate: r.rentalDate }));
        const opItems = operations.map(o => ({ ...o, itemType: 'operation' as const, sortDate: o.startDate! }));

        let allItems = [...rentalItems, ...opItems];

        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            allItems = allItems.filter(item =>
                item.client?.name.toLowerCase().includes(lower) ||
                (item.itemType === 'rental' ? `al${(item as any).sequentialId}` : `op${(item as any).sequentialId}`).includes(lower) ||
                (item.itemType === 'rental' ? (item as any).deliveryAddress : (item as any).destinationAddress).toLowerCase().includes(lower)
            );
        }

        return allItems.sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime());
    }, [rentals, operations, searchTerm]);

    const renderItem = ({ item }: { item: any }) => {
        const isRental = item.itemType === 'rental';
        const title = isRental
            ? item.client?.name
            : item.client?.name;

        const subtitle = isRental
            ? (item.dumpsters || []).map((d: any) => d.name).join(', ')
            : (item.operationTypes || []).map((t: any) => t.name).join(', ');

        const osId = isRental ? `AL${item.sequentialId}` : `OP${item.sequentialId}`;
        const date = isRental ? item.rentalDate : item.startDate;

        return (
            <TouchableOpacity onPress={() => router.push({ pathname: "/os/[id]", params: { id: item.id, type: isRental ? 'rental' : 'operation' } })}>
                <Card className="mb-4 mx-4">
                    <CardHeader className="pb-2">
                        <View className="flex-row justify-between items-start">
                            <View>
                                <Text className="text-xs font-bold text-blue-600 mb-1">{osId}</Text>
                                <CardTitle className="text-lg">{title}</CardTitle>
                            </View>
                            <Badge variant={isRental ? "secondary" : "default"}>
                                <Text className={isRental ? "text-gray-700" : "text-white"}>
                                    {isRental ? "Aluguel" : "Operação"}
                                </Text>
                            </Badge>
                        </View>
                        <CardDescription numberOfLines={1}>{subtitle}</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-2 pb-4">
                        <View className="flex-row items-center mt-1">
                            <Calendar size={14} color="#6B7280" />
                            <Text className="text-gray-500 text-xs ml-1">
                                {new Date(date).toLocaleDateString()}
                            </Text>

                            <View className="w-4" />

                            <MapPin size={14} color="#6B7280" />
                            <Text className="text-gray-500 text-xs ml-1 flex-1" numberOfLines={1}>
                                {isRental ? item.deliveryAddress : item.destinationAddress}
                            </Text>
                        </View>
                    </CardContent>
                </Card>
            </TouchableOpacity>
        );
    };

    if (!accountId && !loading) {
        return (
            <SafeAreaView className="flex-1 items-center justify-center">
                <Text>Carregando perfil...</Text>
            </SafeAreaView>
        )
    }

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <View className="px-4 py-2 bg-white border-b border-gray-200">
                <View className="flex-row items-center bg-gray-100 rounded-md px-3 py-2">
                    <Search size={20} color="#9CA3AF" />
                    <Input
                        placeholder="Buscar OS, cliente..."
                        className="flex-1 border-0 bg-transparent h-8"
                        value={searchTerm}
                        onChangeText={setSearchTerm}
                    />
                </View>
            </View>

            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#2563EB" />
                </View>
            ) : (
                <FlatList
                    data={filteredItems}
                    keyExtractor={(item) => `${item.itemType}-${item.id}`}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingVertical: 16 }}
                    ListEmptyComponent={
                        <View className="items-center justify-center p-8">
                            <Text className="text-gray-500">Nenhuma ordem de serviço encontrada.</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}
