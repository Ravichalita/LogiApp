import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    ActivityIndicator,
    TouchableOpacity,
    Alert,
    RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { ChevronLeft, HardDrive, RotateCcw, Trash2, Plus, Clock, CheckCircle, AlertCircle } from 'lucide-react-native';
import { doc, getDoc } from 'firebase/firestore';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { getFirebase } from '../../lib/firebase';
import { getBackupsAction, createBackupAction, restoreBackupAction, deleteBackupAction, Backup } from '../../lib/actions';

export default function BackupScreen() {
    const router = useRouter();
    const { auth, db } = getFirebase();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [backups, setBackups] = useState<Backup[]>([]);
    const [accountId, setAccountId] = useState<string>('');
    const [actionLoading, setActionLoading] = useState<string | null>(null);

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

            const backupsData = await getBackupsAction(accId);
            setBackups(backupsData);
        } catch (error) {
            console.error('Error loading backups:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const handleCreateBackup = async () => {
        Alert.alert(
            'Criar Backup',
            'Deseja criar um novo backup de todos os dados?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Criar Backup',
                    onPress: async () => {
                        setActionLoading('create');
                        const result = await createBackupAction(accountId);
                        setActionLoading(null);

                        if (result.success) {
                            Alert.alert('Sucesso', 'Backup criado com sucesso!');
                            loadData();
                        } else {
                            Alert.alert('Erro', result.error || 'Falha ao criar backup');
                        }
                    }
                }
            ]
        );
    };

    const handleRestoreBackup = (backup: Backup) => {
        Alert.alert(
            '⚠️ Restaurar Backup',
            `Esta ação é IRREVERSÍVEL!\n\nTodos os dados atuais serão PERMANENTEMENTE EXCLUÍDOS e substituídos pelos dados do backup de ${format(parseISO(backup.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}.\n\nDeseja continuar?`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Restaurar',
                    style: 'destructive',
                    onPress: async () => {
                        setActionLoading(`restore-${backup.id}`);
                        const result = await restoreBackupAction(accountId, backup.id);
                        setActionLoading(null);

                        if (result.success) {
                            Alert.alert('Sucesso', 'Backup restaurado com sucesso! Recarregue o app para ver as mudanças.');
                        } else {
                            Alert.alert('Erro', result.error || 'Falha ao restaurar backup');
                        }
                    }
                }
            ]
        );
    };

    const handleDeleteBackup = (backup: Backup) => {
        Alert.alert(
            'Excluir Backup',
            `Deseja excluir o backup de ${format(parseISO(backup.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}?\n\nEsta ação não pode ser desfeita.`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Excluir',
                    style: 'destructive',
                    onPress: async () => {
                        setActionLoading(`delete-${backup.id}`);
                        const result = await deleteBackupAction(accountId, backup.id);
                        setActionLoading(null);

                        if (result.success) {
                            setBackups(current => current.filter(b => b.id !== backup.id));
                            Alert.alert('Sucesso', 'Backup excluído!');
                        } else {
                            Alert.alert('Erro', result.error || 'Falha ao excluir backup');
                        }
                    }
                }
            ]
        );
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed': return <CheckCircle size={16} color="#16A34A" />;
            case 'pending': return <Clock size={16} color="#EAB308" />;
            case 'failed': return <AlertCircle size={16} color="#DC2626" />;
            default: return <CheckCircle size={16} color="#16A34A" />;
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'completed': return 'Concluído';
            case 'pending': return 'Em progresso';
            case 'failed': return 'Falhou';
            default: return status;
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50" edges={['bottom']}>
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Backup e Restauração',
                    headerLeft: () => (
                        <TouchableOpacity onPress={() => router.back()} className="mr-2">
                            <ChevronLeft size={24} color="#171717" />
                        </TouchableOpacity>
                    ),
                }}
            />

            <ScrollView
                className="flex-1 p-4"
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF9500']} />
                }
            >
                {/* Info Card */}
                <Card className="mb-4 bg-blue-50 border-blue-200">
                    <CardContent className="pt-4">
                        <View className="flex-row items-start">
                            <HardDrive size={20} color="#3B82F6" />
                            <View className="flex-1 ml-3">
                                <Text className="font-medium text-blue-900">Backup de Dados</Text>
                                <Text className="text-blue-700 text-sm mt-1">
                                    Crie backups periódicos dos seus dados para proteção. A restauração substitui todos os dados atuais.
                                </Text>
                            </View>
                        </View>
                    </CardContent>
                </Card>

                {/* Create Backup Button */}
                <TouchableOpacity
                    onPress={handleCreateBackup}
                    disabled={actionLoading !== null}
                    className={`mb-6 rounded-xl py-4 flex-row items-center justify-center ${actionLoading ? 'bg-gray-300' : 'bg-orange-500'}`}
                >
                    {actionLoading === 'create' ? (
                        <ActivityIndicator color="#FFFFFF" />
                    ) : (
                        <>
                            <Plus size={20} color="#FFFFFF" />
                            <Text className="text-white font-bold ml-2">Criar Backup Agora</Text>
                        </>
                    )}
                </TouchableOpacity>

                {/* Backups List */}
                <Text className="text-base font-semibold text-gray-900 mb-3">Backups Disponíveis</Text>

                {loading ? (
                    <ActivityIndicator size="large" color="#FF9500" />
                ) : backups.length === 0 ? (
                    <Card>
                        <CardContent className="py-8 items-center">
                            <HardDrive size={40} color="#D1D5DB" />
                            <Text className="text-gray-500 mt-3">Nenhum backup encontrado</Text>
                            <Text className="text-gray-400 text-sm mt-1">
                                Crie seu primeiro backup para proteção dos dados
                            </Text>
                        </CardContent>
                    </Card>
                ) : (
                    <Card>
                        <CardContent className="py-0">
                            {backups.map((backup, index) => (
                                <View
                                    key={backup.id}
                                    className={`py-4 ${index < backups.length - 1 ? 'border-b border-gray-100' : ''}`}
                                >
                                    <View className="flex-row items-center justify-between mb-2">
                                        <View className="flex-row items-center">
                                            <Clock size={14} color="#6B7280" />
                                            <Text className="font-medium text-gray-900 ml-2">
                                                {format(parseISO(backup.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                            </Text>
                                        </View>
                                        <View className="flex-row items-center">
                                            {getStatusIcon(backup.status)}
                                            <Text className="text-gray-500 text-xs ml-1">{getStatusLabel(backup.status)}</Text>
                                        </View>
                                    </View>

                                    <View className="flex-row items-center mt-2">
                                        <TouchableOpacity
                                            onPress={() => handleRestoreBackup(backup)}
                                            disabled={actionLoading !== null || backup.status !== 'completed'}
                                            className={`flex-1 flex-row items-center justify-center py-2 rounded-lg mr-2 ${backup.status !== 'completed' || actionLoading ? 'bg-gray-100' : 'bg-blue-100'}`}
                                        >
                                            {actionLoading === `restore-${backup.id}` ? (
                                                <ActivityIndicator size="small" color="#3B82F6" />
                                            ) : (
                                                <>
                                                    <RotateCcw size={14} color={backup.status !== 'completed' ? '#9CA3AF' : '#3B82F6'} />
                                                    <Text className={`ml-1 font-medium ${backup.status !== 'completed' ? 'text-gray-400' : 'text-blue-600'}`}>
                                                        Restaurar
                                                    </Text>
                                                </>
                                            )}
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            onPress={() => handleDeleteBackup(backup)}
                                            disabled={actionLoading !== null}
                                            className={`w-10 h-10 items-center justify-center rounded-lg ${actionLoading ? 'bg-gray-100' : 'bg-red-100'}`}
                                        >
                                            {actionLoading === `delete-${backup.id}` ? (
                                                <ActivityIndicator size="small" color="#DC2626" />
                                            ) : (
                                                <Trash2 size={16} color={actionLoading ? '#9CA3AF' : '#DC2626'} />
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                        </CardContent>
                    </Card>
                )}

                <View className="h-8" />
            </ScrollView>
        </SafeAreaView>
    );
}
