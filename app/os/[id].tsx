import { View, Text, ScrollView, TouchableOpacity, Alert, RefreshControl, ActivityIndicator, Platform, Share, Image } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getFirebase } from '../../lib/firebase';
import {
    doc,
    getDoc,
    query,
    collection,
    where,
    getDocs
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
    deleteRentalAction,
    deleteOperationAction,
    cancelRecurrenceAction,
    updateRentalAction,
    updateOperationAction
} from '../../lib/actions';
import { PopulatedRental, PopulatedOperation, Account, Attachment } from '../../lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { ArrowLeft, MapPin, Calendar, Edit, Trash2, Info, MessageCircle, FileText, Share2, Repeat, ExternalLink, RefreshCw, Paperclip, Plus, X } from 'lucide-react-native';
import { differenceInDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as Linking from 'expo-linking';
import * as Print from 'expo-print';
import * as ImagePicker from 'expo-image-picker';
import { shareAsync } from 'expo-sharing';
import { generateOsHtml } from '../../components/OsPdfGenerator';

export default function OSDetail() {
    const { id, type } = useLocalSearchParams<{ id: string, type: 'rental' | 'operation' }>();
    const [item, setItem] = useState<PopulatedRental | PopulatedOperation | null>(null);
    const [loading, setLoading] = useState(true);
    const [accountId, setAccountId] = useState<string | null>(null);
    const [account, setAccount] = useState<Account | null>(null);
    const [uploading, setUploading] = useState(false);

    const router = useRouter();
    const { auth, db, storage } = getFirebase();

    const fetchItem = async () => {
        if (!auth.currentUser) return;
        setLoading(true);

        try {
            // 1. Get Account ID & Data
            const userSnap = await getDoc(doc(db, "users", auth.currentUser.uid));
            if (!userSnap.exists()) return;
            const userData = userSnap.data();
            const accId = userData.accountId;
            setAccountId(accId);

            const accSnap = await getDoc(doc(db, "accounts", accId));
            if (accSnap.exists()) {
                setAccount({ id: accSnap.id, ...accSnap.data() } as Account);
            }

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

            // 3. Populate
            let clientData = null;
            if (data.clientId) {
                const clientSnap = await getDoc(doc(db, `accounts/${accId}/clients`, data.clientId));
                if (clientSnap.exists()) clientData = { id: clientSnap.id, ...clientSnap.data() };
            }

            let dumpstersData: any[] = [];
            if (type === 'rental') {
                const dumpsterIds = data.dumpsterIds || (data.dumpsterId ? [data.dumpsterId] : []);
                if (dumpsterIds.length > 0) {
                    const q = query(collection(db, `accounts/${accId}/dumpsters`), where('__name__', 'in', dumpsterIds.slice(0, 10)));
                    const dSnaps = await getDocs(q);
                    dumpstersData = dSnaps.docs.map(d => ({ id: d.id, ...d.data() }));
                }
            }

            let truckData = null;
            if (type === 'operation' && data.truckId) {
                const truckSnap = await getDoc(doc(db, `accounts/${accId}/fleet`, data.truckId));
                if (truckSnap.exists()) truckData = { id: truckSnap.id, ...truckSnap.data() };
            }

            setItem({
                id: docSnap.id,
                ...data,
                itemType: type,
                client: clientData,
                dumpsters: dumpstersData,
                truck: truckData
            } as any);

        } catch (error) {
            console.error(error);
            Alert.alert("Erro", "Falha ao carregar detalhes");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItem();
    }, [id, type]);

    const handleWhatsApp = () => {
        if (!item?.client?.phone) {
            Alert.alert("Erro", "Cliente sem telefone cadastrado");
            return;
        }

        const isRental = item.itemType === 'rental';
        const osId = isRental ? `AL${(item as any).sequentialId}` : `OP${(item as any).sequentialId}`;
        const text = `Olá ${item.client.name}, estou entrando em contato referente à OS #${osId}.`;
        const phone = item.client.phone.replace(/\D/g, '');

        Linking.openURL(`whatsapp://send?phone=55${phone}&text=${encodeURIComponent(text)}`);
    };

    const handlePdf = async () => {
        if (!item) return;
        try {
            const html = generateOsHtml(item, account);
            const { uri } = await Print.printToFileAsync({ html });
            await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
        } catch (error) {
            console.error(error);
            Alert.alert("Erro", "Falha ao gerar PDF");
        }
    };

    const handleSwap = () => {
        if (!item || item.itemType !== 'rental') return;
        router.push({
            pathname: '/rentals/new',
            params: { cloneFromId: item.id }
        });
    };

    const handleCancelRecurrence = async () => {
        if (!item || !item.recurrenceProfileId || !accountId) return;

        Alert.alert(
            "Cancelar Recorrência",
            "Tem certeza que deseja cancelar a recorrência deste serviço? Futuras ordens de serviço automáticas serão canceladas.",
            [
                { text: "Não", style: "cancel" },
                {
                    text: "Sim, Cancelar",
                    style: "destructive",
                    onPress: async () => {
                        const result = await cancelRecurrenceAction(accountId, item.recurrenceProfileId!);
                        if (result.success) {
                            Alert.alert("Sucesso", "Recorrência cancelada.");
                            fetchItem();
                        } else {
                            Alert.alert("Erro", result.error || "Falha ao cancelar recorrência.");
                        }
                    }
                }
            ]
        );
    };

    const handleAddAttachment = async () => {
        if (!accountId || !item) return;

        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                quality: 0.8,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                setUploading(true);

                // Upload
                const response = await fetch(asset.uri);
                const blob = await response.blob();
                const filename = `os_attachments/${item.id}/${Date.now()}.jpg`;
                const storageRef = ref(storage, `accounts/${accountId}/${filename}`);

                await uploadBytes(storageRef, blob);
                const url = await getDownloadURL(storageRef);

                const newAttachment: Attachment = {
                    url,
                    path: filename,
                    name: `Foto ${new Date().toLocaleTimeString()}`,
                    type: 'image/jpeg',
                    uploadedAt: new Date().toISOString()
                };

                const currentAttachments = item.attachments || [];
                const updatedAttachments = [...currentAttachments, newAttachment];

                // Update Doc
                let updateResult;
                if (item.itemType === 'rental') {
                    updateResult = await updateRentalAction(accountId, item.id, { attachments: updatedAttachments });
                } else {
                    updateResult = await updateOperationAction(accountId, item.id, { attachments: updatedAttachments });
                }

                if (updateResult.success) {
                    setItem(prev => prev ? ({ ...prev, attachments: updatedAttachments } as any) : null);
                } else {
                    Alert.alert("Erro", "Falha ao salvar anexo.");
                }
            }
        } catch (error) {
            console.error(error);
            Alert.alert("Erro", "Falha no upload.");
        } finally {
            setUploading(false);
        }
    };

    if (loading && !item) { // Show loading only on initial load
        return (
            <SafeAreaView className="flex-1 items-center justify-center bg-gray-50">
                <ActivityIndicator size="large" color="#FF9500" />
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
            <View className="px-4 py-3 bg-white border-b border-gray-200 flex-row items-center justify-between">
                <View className="flex-row items-center">
                    <TouchableOpacity onPress={() => router.back()} className="mr-3">
                        <ArrowLeft size={24} color="#1F2937" />
                    </TouchableOpacity>
                    <View>
                        <Text className="text-lg font-bold text-gray-900">Detalhes da OS</Text>
                        <Text className="text-xs text-gray-500">{osId}</Text>
                    </View>
                </View>
                <View className="flex-row gap-2">
                    {/* Swap Action (Only for Rentals) */}
                    {isRental && (
                        <TouchableOpacity onPress={handleSwap} className="p-2 bg-orange-50 rounded-full">
                            <RefreshCw size={20} color="#F97316" />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={handleWhatsApp} className="p-2 bg-green-50 rounded-full">
                        <MessageCircle size={20} color="#16A34A" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handlePdf} className="p-2 bg-blue-50 rounded-full">
                        <FileText size={20} color="#2563EB" />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                contentContainerClassName="p-4 space-y-4"
                refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchItem} />}
            >
                {/* Main Info Card */}
                <Card>
                    <CardHeader>
                        <View className="flex-row justify-between">
                            <View className="flex-1 mr-2">
                                <CardTitle className="text-xl">{title}</CardTitle>
                                {isRental ? (item as any).dumpsters?.map((d: any) => (
                                    <Text key={d.id} className="text-gray-500 text-sm mt-1">• {d.name} ({d.size}m³)</Text>
                                )) : (
                                    <Text className="text-gray-500 text-sm mt-1">
                                        {(item as any).operationTypes?.map((t: any) => t.name).join(', ') || 'Operação'}
                                    </Text>
                                )}
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
                                <TouchableOpacity
                                    className="flex-row items-center mt-2 bg-blue-50 self-start px-3 py-1.5 rounded-full"
                                    onPress={() => {
                                        const address = isRental ? (item as any).deliveryAddress : (item as any).destinationAddress;
                                        const url = Platform.select({
                                            ios: `maps:0,0?q=${address}`,
                                            android: `geo:0,0?q=${address}`,
                                        });
                                        if (url) Linking.openURL(url);
                                    }}
                                >
                                    <MapPin size={14} color="#3B82F6" />
                                    <Text className="text-blue-600 text-xs font-semibold ml-1">Abrir Mapa</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View className="flex-row items-start gap-3">
                            <Calendar size={20} color="#4B5563" className="mt-0.5" />
                            <View className="flex-1">
                                <Text className="font-semibold text-gray-700">Período</Text>
                                <Text className="text-gray-600">{dateLine}</Text>
                            </View>
                        </View>

                        {/* Recurrence Info & Action */}
                        {item.recurrenceProfileId && (
                            <View className="flex-row items-start gap-3 pt-2 border-t border-gray-100 mt-2">
                                <Repeat size={20} color="#9333EA" className="mt-0.5" />
                                <View className="flex-1">
                                    <Text className="font-semibold text-purple-600">Assinatura Recorrente</Text>
                                    <Text className="text-gray-500 text-xs mb-2">Este serviço faz parte de uma assinatura.</Text>
                                    <TouchableOpacity
                                        onPress={handleCancelRecurrence}
                                        className="bg-red-50 self-start px-3 py-1.5 rounded-md border border-red-100"
                                    >
                                        <Text className="text-red-600 text-xs font-semibold">Cancelar Recorrência</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {item.observations && (
                            <View className="flex-row items-start gap-3 mt-2">
                                <Info size={20} color="#4B5563" className="mt-0.5" />
                                <View className="flex-1">
                                    <Text className="font-semibold text-gray-700">Observações</Text>
                                    <Text className="text-gray-600">{item.observations}</Text>
                                </View>
                            </View>
                        )}
                    </CardContent>
                </Card>

                {/* Attachments Section */}
                <Card>
                    <CardHeader className="pb-3">
                        <View className="flex-row justify-between items-center">
                            <CardTitle className="text-lg">Anexos</CardTitle>
                            <TouchableOpacity onPress={handleAddAttachment} disabled={uploading}>
                                {uploading ? (
                                    <ActivityIndicator size="small" color="#F97316" />
                                ) : (
                                    <View className="flex-row items-center bg-orange-50 px-3 py-1.5 rounded-full">
                                        <Plus size={16} color="#F97316" className="mr-1" />
                                        <Text className="text-orange-600 text-xs font-bold">Adicionar</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>
                    </CardHeader>
                    <CardContent>
                        {item.attachments && item.attachments.length > 0 ? (
                            <View className="flex-row flex-wrap gap-2">
                                {item.attachments.map((att, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        onPress={() => Linking.openURL(att.url)}
                                        className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden relative"
                                    >
                                        <Image source={{ uri: att.url }} className="w-full h-full" resizeMode="cover" />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ) : (
                            <View className="items-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                <Paperclip size={24} color="#9CA3AF" />
                                <Text className="text-gray-400 text-sm mt-2">Nenhum anexo</Text>
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
                <View className="gap-3 mt-2">
                    <TouchableOpacity
                        className="flex-row items-center justify-center bg-orange-500 rounded-lg py-3"
                        onPress={() => router.push({
                            pathname: isRental ? '/rentals/edit' : '/operations/edit',
                            params: { id: item.id }
                        })}
                    >
                        <Edit size={18} color="#FFFFFF" />
                        <Text className="text-white font-semibold ml-2">Editar OS</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        className="flex-row items-center justify-center bg-white border border-red-200 rounded-lg py-3"
                        onPress={() => {
                            Alert.alert(
                                'Excluir OS',
                                `Tem certeza que deseja excluir ${osId}? Esta ação não pode ser desfeita.`,
                                [
                                    { text: 'Cancelar', style: 'cancel' },
                                    {
                                        text: 'Excluir',
                                        style: 'destructive',
                                        onPress: async () => {
                                            try {
                                                const result = isRental
                                                    ? await deleteRentalAction(accountId!, item.id)
                                                    : await deleteOperationAction(accountId!, item.id);

                                                if (result.success) {
                                                    Alert.alert('Sucesso', 'OS excluída com sucesso!');
                                                    router.back();
                                                } else {
                                                    Alert.alert('Erro', result.error || 'Falha ao excluir OS.');
                                                }
                                            } catch (error) {
                                                Alert.alert('Erro', 'Ocorreu um erro ao excluir a OS.');
                                            }
                                        }
                                    }
                                ]
                            );
                        }}
                    >
                        <Trash2 size={18} color="#DC2626" />
                        <Text className="text-red-600 font-semibold ml-2">Excluir OS</Text>
                    </TouchableOpacity>
                </View>

                <View className="h-8" />
            </ScrollView>
        </SafeAreaView>
    );
}
