import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState, useMemo } from "react";
import { getFirebase } from "../../lib/firebase";
import { getClients } from "../../lib/data";
import { Client } from "../../lib/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Search, Phone, MapPin, Mail, Star } from "lucide-react-native";
import { onAuthStateChanged } from "firebase/auth";
import { differenceInDays, parseISO } from "date-fns";
import { Badge } from "../../components/ui/badge";
import { useRouter } from "expo-router";

export default function Clients() {
    const [clients, setClients] = useState<Client[]>([]);
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
        const unsubscribe = getClients(accountId, (data) => {
            setClients(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [accountId]);

    const filteredClients = useMemo(() => {
        if (!searchTerm) return clients;
        const lowerTerm = searchTerm.toLowerCase();
        return clients.filter(c =>
            c.name.toLowerCase().includes(lowerTerm) ||
            (c.phone && c.phone.includes(lowerTerm)) ||
            (c.address && c.address.toLowerCase().includes(lowerTerm))
        );
    }, [clients, searchTerm]);

    const handleCall = (phone: string) => {
        Linking.openURL(`tel:${phone}`);
    };

    const renderClient = ({ item }: { item: Client }) => {
        const isNew = item.createdAt ? differenceInDays(new Date(), parseISO(item.createdAt as any)) <= 3 : false;

        return (
            <TouchableOpacity onPress={() => router.push({ pathname: "/clients/[id]", params: { id: item.id } })}>
                <Card className="mb-4 mx-4">
                    <CardHeader className="pb-2">
                        <View className="flex-row justify-between items-start">
                            <CardTitle className="text-lg flex-1">{item.name}</CardTitle>
                            {isNew && (
                                <Badge variant="warning" className="ml-2">
                                    <Star size={10} color="white" fill="white" />
                                    <Text className="text-white text-[10px] ml-1">Novo</Text>
                                </Badge>
                            )}
                        </View>
                    </CardHeader>
                    <CardContent>
                        {item.phone && (
                            <TouchableOpacity onPress={() => handleCall(item.phone)} className="flex-row items-center mb-2">
                                <Phone size={14} color="#2563EB" />
                                <Text className="text-blue-600 ml-2 font-medium">{item.phone}</Text>
                            </TouchableOpacity>
                        )}

                        {item.address && (
                            <View className="flex-row items-center mb-2">
                                <MapPin size={14} color="#6B7280" />
                                <Text className="text-gray-600 ml-2 text-sm flex-1">{item.address}</Text>
                            </View>
                        )}

                        {item.email && (
                            <View className="flex-row items-center">
                                <Mail size={14} color="#6B7280" />
                                <Text className="text-gray-500 ml-2 text-sm">{item.email}</Text>
                            </View>
                        )}
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
                        placeholder="Buscar cliente..."
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
                    data={filteredClients}
                    keyExtractor={(item) => item.id}
                    renderItem={renderClient}
                    contentContainerStyle={{ paddingVertical: 16 }}
                    ListEmptyComponent={
                        <View className="items-center justify-center p-8">
                            <Text className="text-gray-500">Nenhum cliente encontrado.</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}
