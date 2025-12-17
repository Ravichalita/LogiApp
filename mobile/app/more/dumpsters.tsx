import { View, Text, FlatList, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState, useMemo } from "react";
import { getFirebase } from "../../lib/firebase";
import { getDumpsters } from "../../lib/data";
import { Dumpster, DUMPSTER_COLORS } from "../../lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Stack, useRouter } from "expo-router";
import { ArrowLeft, Trash2 } from "lucide-react-native";
import { TouchableOpacity } from "react-native";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";

export default function DumpstersList() {
    const [dumpsters, setDumpsters] = useState<Dumpster[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("");
    const { auth, db } = getFirebase();
    const router = useRouter();

    useEffect(() => {
        const fetchDumpsters = async () => {
            if (!auth.currentUser) return;
            const { doc, getDoc } = require("firebase/firestore");
            const userSnap = await getDoc(doc(db, "users", auth.currentUser.uid));

            if (userSnap.exists()) {
                const accountId = userSnap.data().accountId;
                return getDumpsters(accountId, (data) => {
                    setDumpsters(data);
                    setLoading(false);
                });
            }
            setLoading(false);
            return () => { };
        };

        let unsubscribe: any;
        fetchDumpsters().then(unsub => { unsubscribe = unsub; });
        return () => { if (unsubscribe) unsubscribe(); };
    }, []);

    const filteredDumpsters = useMemo(() => {
        if (!filter) return dumpsters;
        return dumpsters.filter(d => d.name.toLowerCase().includes(filter.toLowerCase()));
    }, [dumpsters, filter]);

    const renderDumpster = ({ item }: { item: Dumpster }) => {
        const colorInfo = DUMPSTER_COLORS[item.color] || { value: '#9CA3AF', description: 'Desconhecido' };

        return (
            <Card className="mb-4 mx-4">
                <CardHeader className="pb-2 flex-row justify-between items-start">
                    <View className="flex-row items-center">
                        <View className="w-4 h-4 rounded-full mr-3 border border-gray-200" style={{ backgroundColor: colorInfo.value }} />
                        <CardTitle className="text-lg">{item.name}</CardTitle>
                    </View>
                    <Badge variant={item.status === 'Disponível' ? 'success' : 'secondary'}>
                        <Text className={item.status === 'Disponível' ? 'text-green-800' : 'text-gray-600'}>
                            {item.status}
                        </Text>
                    </Badge>
                </CardHeader>
                <CardContent>
                    <View className="flex-row justify-between items-center mt-1">
                        <View>
                            <Text className="text-xs text-gray-400 uppercase">Tamanho</Text>
                            <Text className="text-gray-700 font-medium">{item.size}m³</Text>
                        </View>
                        <View className="flex-1 ml-6">
                            <Text className="text-xs text-gray-400 uppercase">Tipo de Resíduo</Text>
                            <Text className="text-gray-700 font-medium" numberOfLines={1}>{colorInfo.description}</Text>
                        </View>
                    </View>
                </CardContent>
            </Card>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <Stack.Screen options={{ headerShown: false }} />

            <View className="px-4 py-3 bg-white border-b border-gray-200">
                <View className="flex-row items-center mb-2">
                    <TouchableOpacity onPress={() => router.back()} className="mr-3">
                        <ArrowLeft size={24} color="#1F2937" />
                    </TouchableOpacity>
                    <Text className="text-lg font-bold text-gray-900">Caçambas</Text>
                </View>
                <Input
                    placeholder="Buscar caçamba..."
                    value={filter}
                    onChangeText={setFilter}
                    className="h-10"
                />
            </View>

            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#2563EB" />
                </View>
            ) : (
                <FlatList
                    data={filteredDumpsters}
                    keyExtractor={item => item.id}
                    renderItem={renderDumpster}
                    contentContainerClassName="py-4"
                    ListEmptyComponent={
                        <View className="items-center justify-center p-8">
                            <Text className="text-gray-500">Nenhuma caçamba encontrada.</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}
