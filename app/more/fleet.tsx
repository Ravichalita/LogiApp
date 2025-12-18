import { View, Text, FlatList, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { getFirebase } from "../../lib/firebase";
import { getTrucks } from "../../lib/data";
import { Truck } from "../../lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Stack, useRouter } from "expo-router";
import { ArrowLeft, Truck as TruckIcon } from "lucide-react-native";
import { TouchableOpacity } from "react-native";
import { Badge } from "../../components/ui/badge";

export default function FleetList() {
    const [trucks, setTrucks] = useState<Truck[]>([]);
    const [loading, setLoading] = useState(true);
    const { auth, db } = getFirebase();
    const router = useRouter();

    useEffect(() => {
        const fetchTrucks = async () => {
            if (!auth.currentUser) return;
            const { doc, getDoc } = require("firebase/firestore");
            const userSnap = await getDoc(doc(db, "users", auth.currentUser.uid));

            if (userSnap.exists()) {
                const accountId = userSnap.data().accountId;
                return getTrucks(accountId, (data) => {
                    setTrucks(data);
                    setLoading(false);
                });
            }
            setLoading(false);
            return () => { };
        };

        let unsubscribe: any;
        fetchTrucks().then(unsub => { unsubscribe = unsub; });
        return () => { if (unsubscribe) unsubscribe(); };
    }, []);

    const renderTruck = ({ item }: { item: Truck }) => (
        <Card className="mb-4 mx-4">
            <CardHeader className="pb-2 flex-row justify-between items-start">
                <View className="flex-row items-center">
                    <View className="w-10 h-10 bg-blue-50 rounded-full items-center justify-center mr-3">
                        <TruckIcon size={20} color="#FF9500" />
                    </View>
                    <View>
                        <CardTitle className="text-lg">{item.name}</CardTitle>
                        <Text className="text-gray-500 text-sm font-semibold">{item.plate}</Text>
                    </View>
                </View>
                <Badge variant={item.status === 'Disponível' ? 'success' : 'secondary'}>
                    <Text className={item.status === 'Disponível' ? 'text-green-800' : 'text-gray-600'}>
                        {item.status}
                    </Text>
                </Badge>
            </CardHeader>
            <CardContent>
                <View className="flex-row gap-4 mt-2">
                    <View>
                        <Text className="text-xs text-gray-400 uppercase">Tipo</Text>
                        {/* We would fetch type name in real app, showing raw or logic here */}
                        <Text className="text-gray-700 font-medium">{item.type || 'Padrão'}</Text>
                    </View>
                    {item.year && (
                        <View>
                            <Text className="text-xs text-gray-400 uppercase">Ano</Text>
                            <Text className="text-gray-700 font-medium">{item.year}</Text>
                        </View>
                    )}
                </View>
            </CardContent>
        </Card>
    );

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <Stack.Screen options={{ headerShown: false }} />

            <View className="px-4 py-3 bg-white border-b border-gray-200 flex-row items-center">
                <TouchableOpacity onPress={() => router.back()} className="mr-3">
                    <ArrowLeft size={24} color="#1F2937" />
                </TouchableOpacity>
                <Text className="text-lg font-bold text-gray-900">Frota</Text>
            </View>

            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#FF9500" />
                </View>
            ) : (
                <FlatList
                    data={trucks}
                    keyExtractor={item => item.id}
                    renderItem={renderTruck}
                    contentContainerClassName="py-4"
                    ListEmptyComponent={
                        <View className="items-center justify-center p-8">
                            <Text className="text-gray-500">Nenhum veículo encontrado.</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}
