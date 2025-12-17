import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Alert, Linking } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getFirebase } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Client } from '../../lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { MapPin, Mail, Phone, ArrowLeft, Star } from 'lucide-react-native';
import { Badge } from '../../components/ui/badge';
import { differenceInDays, parseISO } from 'date-fns';

export default function ClientDetail() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const [client, setClient] = useState<Client | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const { auth, db } = getFirebase();

    useEffect(() => {
        const fetchClient = async () => {
            if (!auth.currentUser || !id) return;

            try {
                const userSnap = await getDoc(doc(db, "users", auth.currentUser.uid));
                if (!userSnap.exists()) return;
                const accountId = userSnap.data().accountId;

                const docRef = doc(db, `accounts/${accountId}/clients`, id);
                const docSnap = await getDoc(docRef);

                if (!docSnap.exists()) {
                    Alert.alert("Erro", "Cliente não encontrado");
                    router.back();
                    return;
                }

                setClient({ id: docSnap.id, ...docSnap.data() } as Client);

            } catch (error) {
                console.error(error);
                Alert.alert("Erro", "Falha ao carregar cliente");
            } finally {
                setLoading(false);
            }
        };

        fetchClient();
    }, [id]);

    const handleCall = (phone: string) => {
        Linking.openURL(`tel:${phone}`);
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 items-center justify-center bg-gray-50">
                <ActivityIndicator size="large" color="#2563EB" />
            </SafeAreaView>
        );
    }

    if (!client) return null;

    const isNew = client.createdAt ? differenceInDays(new Date(), parseISO(client.createdAt as any)) <= 3 : false;

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <Stack.Screen options={{ headerShown: false }} />

            <View className="px-4 py-3 bg-white border-b border-gray-200 flex-row items-center">
                <TouchableOpacity onPress={() => router.back()} className="mr-3">
                    <ArrowLeft size={24} color="#1F2937" />
                </TouchableOpacity>
                <Text className="text-lg font-bold text-gray-900">Detalhes do Cliente</Text>
            </View>

            <ScrollView contentContainerClassName="p-4 space-y-4">
                <Card>
                    <CardHeader>
                        <View className="flex-row justify-between items-start">
                            <CardTitle className="text-xl flex-1">{client.name}</CardTitle>
                            {isNew && (
                                <Badge variant="warning">
                                    <Star size={10} color="white" fill="white" />
                                    <Text className="text-white text-[10px] ml-1">Novo</Text>
                                </Badge>
                            )}
                        </View>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {client.phone && (
                            <TouchableOpacity onPress={() => handleCall(client.phone)} className="flex-row items-center gap-3">
                                <Phone size={20} color="#2563EB" />
                                <View>
                                    <Text className="font-semibold text-gray-700">Telefone</Text>
                                    <Text className="text-blue-600 font-medium">{client.phone}</Text>
                                </View>
                            </TouchableOpacity>
                        )}

                        {client.email && (
                            <View className="flex-row items-center gap-3">
                                <Mail size={20} color="#4B5563" />
                                <View>
                                    <Text className="font-semibold text-gray-700">Email</Text>
                                    <Text className="text-gray-600">{client.email}</Text>
                                </View>
                            </View>
                        )}

                        {client.address && (
                            <View className="flex-row items-start gap-3">
                                <MapPin size={20} color="#4B5563" className="mt-0.5" />
                                <View className="flex-1">
                                    <Text className="font-semibold text-gray-700">Endereço</Text>
                                    <Text className="text-gray-600">{client.address}</Text>
                                </View>
                            </View>
                        )}

                        {client.observations && (
                            <View className="mt-2 pt-2 border-t border-gray-100">
                                <Text className="font-semibold text-gray-700 mb-1">Observações</Text>
                                <Text className="text-gray-600 italic">{client.observations}</Text>
                            </View>
                        )}
                    </CardContent>
                </Card>

                <Button className="w-full" variant="outline" onPress={() => Alert.alert("Em breve", "Edição será implementada na próxima fase.")}>
                    Editar Cliente
                </Button>
            </ScrollView>
        </SafeAreaView>
    );
}
