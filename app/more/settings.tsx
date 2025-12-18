import React, { useState, useEffect } from 'react';
import { View, Text, Alert, TouchableOpacity, ScrollView, Switch, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import {
    ArrowLeft,
    LogOut,
    Info,
    User,
    Building2,
    Bell,
    Moon,
    HelpCircle,
    ChevronRight,
    Mail,
    Phone,
    Shield,
    Crown,
    Edit2,
    X
} from "lucide-react-native";
import { doc, getDoc } from 'firebase/firestore';
import { getFirebase } from "../../lib/firebase";
import { signOut } from "firebase/auth";
import { Card, CardContent } from "../../components/ui/card";
import { UserAccount, Account } from "../../lib/types";
import { updateUserAction } from "../../lib/actions";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";

const roleLabels: Record<string, string> = {
    superadmin: 'Super Admin',
    owner: 'Proprietário',
    admin: 'Administrador',
    viewer: 'Visualizador'
};

export default function SettingsScreen() {
    const router = useRouter();
    const { auth, db } = getFirebase();

    const [loading, setLoading] = useState(true);
    const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
    const [account, setAccount] = useState<Account | null>(null);
    const [notifications, setNotifications] = useState(true);
    const [darkMode, setDarkMode] = useState(false);

    // Edit Modal State
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState("");
    const [editPhone, setEditPhone] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadUserData();
    }, []);

    const loadUserData = async () => {
        if (!auth.currentUser) return;

        try {
            // Get user document to find accountId
            const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
            if (!userDoc.exists()) return;

            const userData = userDoc.data();
            const accountId = userData.accountId;

            // Get user account details
            const userAccountDoc = await getDoc(doc(db, `accounts/${accountId}/team`, auth.currentUser.uid));
            if (userAccountDoc.exists()) {
                const data = userAccountDoc.data();
                setUserAccount({ ...data, id: userAccountDoc.id } as UserAccount);
                setEditName(data.name || "");
                setEditPhone(data.phone || "");
            }

            // Get account/company details
            const accountDoc = await getDoc(doc(db, 'accounts', accountId));
            if (accountDoc.exists()) {
                setAccount({ id: accountDoc.id, ...accountDoc.data() } as Account);
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        Alert.alert(
            'Sair da conta',
            'Tem certeza que deseja sair?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Sair',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await signOut(auth);
                            router.replace("/(auth)/login");
                        } catch (error) {
                            console.error("Logout error:", error);
                            Alert.alert("Erro", "Falha ao sair da conta.");
                        }
                    }
                }
            ]
        );
    };

    const handleSaveProfile = async () => {
        if (!editName.trim()) {
            Alert.alert("Erro", "O nome não pode estar vazio.");
            return;
        }

        if (!auth.currentUser || !userAccount) return;

        setSaving(true);
        try {
            const result = await updateUserAction(auth.currentUser.uid, userAccount.accountId, {
                name: editName,
                phone: editPhone
            });

            if (result.success) {
                Alert.alert("Sucesso", "Perfil atualizado com sucesso.");
                setIsEditing(false);
                loadUserData(); // Refresh data
            } else {
                Alert.alert("Erro", result.error || "Falha ao atualizar perfil.");
            }
        } catch (error) {
            console.error(error);
            Alert.alert("Erro", "Falha ao atualizar perfil.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50" edges={['bottom']}>
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Configurações',
                    headerLeft: () => (
                        <TouchableOpacity onPress={() => router.back()} className="mr-2">
                            <ArrowLeft size={24} color="#171717" />
                        </TouchableOpacity>
                    ),
                }}
            />

            <ScrollView className="flex-1">
                {loading ? (
                    <View className="items-center justify-center py-20">
                        <ActivityIndicator size="large" color="#FF9500" />
                    </View>
                ) : (
                    <>
                        {/* Profile Card */}
                        <View className="p-4">
                            <Card className="bg-orange-500">
                                <CardContent className="pt-6 pb-6">
                                    <View className="flex-row items-center justify-between">
                                        <View className="flex-row items-center flex-1">
                                            <View className="w-16 h-16 bg-white/20 rounded-full items-center justify-center mr-4">
                                                <User size={32} color="#FFFFFF" />
                                            </View>
                                            <View className="flex-1">
                                                <Text className="text-white text-xl font-bold">
                                                    {userAccount?.name || auth.currentUser?.displayName || 'Usuário'}
                                                </Text>
                                                <Text className="text-orange-100 text-sm">
                                                    {auth.currentUser?.email}
                                                </Text>
                                                {userAccount?.phone && (
                                                    <Text className="text-orange-100 text-xs mt-0.5">
                                                        {userAccount.phone}
                                                    </Text>
                                                )}
                                                <View className="flex-row items-center mt-2">
                                                    <View className="bg-white/20 px-2 py-1 rounded-full flex-row items-center">
                                                        {userAccount?.role === 'owner' || userAccount?.role === 'superadmin' ? (
                                                            <Crown size={12} color="#FFFFFF" />
                                                        ) : (
                                                            <Shield size={12} color="#FFFFFF" />
                                                        )}
                                                        <Text className="text-white text-xs ml-1">
                                                            {roleLabels[userAccount?.role || 'viewer']}
                                                        </Text>
                                                    </View>
                                                </View>
                                            </View>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => setIsEditing(true)}
                                            className="bg-white/20 p-2 rounded-full"
                                        >
                                            <Edit2 size={20} color="#FFFFFF" />
                                        </TouchableOpacity>
                                    </View>
                                </CardContent>
                            </Card>
                        </View>

                        {/* Company Info */}
                        <View className="px-4 mb-4">
                            <Text className="text-gray-500 text-xs font-semibold uppercase mb-2 ml-2">
                                Empresa
                            </Text>
                            <Card>
                                <CardContent className="pt-4 pb-4">
                                    <View className="flex-row items-center">
                                        <View className="w-12 h-12 bg-gray-100 rounded-full items-center justify-center mr-3">
                                            <Building2 size={24} color="#6B7280" />
                                        </View>
                                        <View className="flex-1">
                                            <Text className="font-semibold text-gray-900">
                                                {account?.name || 'Empresa'}
                                            </Text>
                                            {account?.phone && (
                                                <View className="flex-row items-center mt-1">
                                                    <Phone size={12} color="#6B7280" />
                                                    <Text className="text-gray-500 text-sm ml-1">{account.phone}</Text>
                                                </View>
                                            )}
                                            {account?.email && (
                                                <View className="flex-row items-center mt-1">
                                                    <Mail size={12} color="#6B7280" />
                                                    <Text className="text-gray-500 text-sm ml-1">{account.email}</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                </CardContent>
                            </Card>
                        </View>

                        {/* Preferences */}
                        <View className="px-4 mb-4">
                            <Text className="text-gray-500 text-xs font-semibold uppercase mb-2 ml-2">
                                Preferências
                            </Text>
                            <Card>
                                <CardContent className="py-0">
                                    <TouchableOpacity
                                        className="flex-row items-center justify-between py-4 border-b border-gray-100"
                                    >
                                        <View className="flex-row items-center">
                                            <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center mr-3">
                                                <Bell size={20} color="#3B82F6" />
                                            </View>
                                            <Text className="font-medium text-gray-900">Notificações</Text>
                                        </View>
                                        <Switch
                                            value={notifications}
                                            onValueChange={setNotifications}
                                            trackColor={{ false: '#D1D5DB', true: '#FB923C' }}
                                            thumbColor={notifications ? '#FF9500' : '#f4f3f4'}
                                        />
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        className="flex-row items-center justify-between py-4"
                                    >
                                        <View className="flex-row items-center">
                                            <View className="w-10 h-10 bg-purple-100 rounded-full items-center justify-center mr-3">
                                                <Moon size={20} color="#8B5CF6" />
                                            </View>
                                            <Text className="font-medium text-gray-900">Modo Escuro</Text>
                                        </View>
                                        <Switch
                                            value={darkMode}
                                            onValueChange={setDarkMode}
                                            trackColor={{ false: '#D1D5DB', true: '#FB923C' }}
                                            thumbColor={darkMode ? '#FF9500' : '#f4f3f4'}
                                        />
                                    </TouchableOpacity>
                                </CardContent>
                            </Card>
                        </View>

                        {/* Support */}
                        <View className="px-4 mb-4">
                            <Text className="text-gray-500 text-xs font-semibold uppercase mb-2 ml-2">
                                Suporte
                            </Text>
                            <Card>
                                <CardContent className="py-0">
                                    <TouchableOpacity
                                        className="flex-row items-center justify-between py-4"
                                        onPress={() => Alert.alert('Ajuda', 'Entre em contato pelo email: suporte@chalitadigital.com.br')}
                                    >
                                        <View className="flex-row items-center">
                                            <View className="w-10 h-10 bg-green-100 rounded-full items-center justify-center mr-3">
                                                <HelpCircle size={20} color="#16A34A" />
                                            </View>
                                            <Text className="font-medium text-gray-900">Central de Ajuda</Text>
                                        </View>
                                        <ChevronRight size={20} color="#9CA3AF" />
                                    </TouchableOpacity>
                                </CardContent>
                            </Card>
                        </View>

                        {/* Logout */}
                        <View className="px-4 mb-4">
                            <TouchableOpacity
                                className="bg-red-50 border border-red-200 rounded-xl p-4 flex-row items-center justify-center"
                                onPress={handleLogout}
                            >
                                <LogOut size={20} color="#DC2626" />
                                <Text className="text-red-600 font-semibold ml-2">Sair da Conta</Text>
                            </TouchableOpacity>
                        </View>

                        {/* App Info */}
                        <View className="px-4 pb-8 items-center">
                            <View className="flex-row items-center mb-2">
                                <Info size={16} color="#9CA3AF" />
                                <Text className="text-gray-400 text-sm ml-1">LogiApp Mobile</Text>
                            </View>
                            <Text className="text-gray-400 text-xs">Versão 1.0.0 (Beta)</Text>
                            <Text className="text-gray-400 text-xs mt-1">© 2024 Chalita Digital</Text>
                        </View>
                    </>
                )}
            </ScrollView>

            {/* Edit Profile Modal */}
            <Modal
                visible={isEditing}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setIsEditing(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    className="flex-1 justify-end bg-black/50"
                >
                    <TouchableWithoutFeedback onPress={() => setIsEditing(false)}>
                        <View className="flex-1" />
                    </TouchableWithoutFeedback>
                    <View className="bg-white rounded-t-3xl p-6">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-xl font-bold text-gray-900">Editar Perfil</Text>
                            <TouchableOpacity onPress={() => setIsEditing(false)}>
                                <X size={24} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        <View className="space-y-4 mb-6">
                            <View>
                                <Text className="text-sm font-medium text-gray-700 mb-1">Nome Completo</Text>
                                <Input
                                    value={editName}
                                    onChangeText={setEditName}
                                    placeholder="Seu nome"
                                    autoCapitalize="words"
                                />
                            </View>
                            <View>
                                <Text className="text-sm font-medium text-gray-700 mb-1">Telefone / WhatsApp</Text>
                                <Input
                                    value={editPhone}
                                    onChangeText={setEditPhone}
                                    placeholder="Seu telefone"
                                    keyboardType="phone-pad"
                                />
                            </View>
                        </View>

                        <Button
                            className="bg-orange-500 w-full"
                            onPress={handleSaveProfile}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text className="text-white font-bold text-center">Salvar Alterações</Text>
                            )}
                        </Button>
                        <View className="h-6" />
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
}
