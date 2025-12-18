import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    ActivityIndicator,
    TouchableOpacity,
    Alert,
    Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { ChevronLeft, ChevronDown, ChevronUp, User, Shield, Eye, Crown, Mail, Phone } from 'lucide-react-native';

import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { getFirebase } from '../../lib/firebase';
import { getTeam } from '../../lib/data';
import { updateUserPermissionsAction } from '../../lib/actions';
import { UserAccount, Permissions } from '../../lib/types';

const roleLabels: Record<string, string> = {
    superadmin: 'Super Admin',
    owner: 'Proprietário',
    admin: 'Admin',
    viewer: 'Visualizador'
};

const roleColors: Record<string, { bg: string; text: string; icon: any }> = {
    superadmin: { bg: 'bg-purple-100', text: 'text-purple-800', icon: Crown },
    owner: { bg: 'bg-orange-100', text: 'text-orange-800', icon: Crown },
    admin: { bg: 'bg-blue-100', text: 'text-blue-800', icon: Shield },
    viewer: { bg: 'bg-gray-100', text: 'text-gray-800', icon: Eye }
};

// Permission labels grouped by category
const screenPermissions: Partial<Record<keyof Permissions, string>> = {
    canAccessRentals: 'Aluguéis',
    canAccessOperations: 'Operações',
    canAccessRoutes: 'Rotas',
    canAccessClients: 'Clientes',
    canAccessDumpsters: 'Caçambas',
    canAccessFleet: 'Frota',
    canAccessTeam: 'Equipe',
    canAccessSettings: 'Configurações',
};

const featurePermissions: Partial<Record<keyof Permissions, string>> = {
    canAccessFinance: 'Finanças',
    canSeeServiceValue: 'Ver Valores',
    canUseAttachments: 'Anexos',
};

const actionPermissions: Partial<Record<keyof Permissions, string>> = {
    canEditRentals: 'Editar Aluguéis',
    canEditOperations: 'Editar Operações',
    canEditDumpsters: 'Editar Caçambas',
    canEditFleet: 'Editar Frota',
    canAddClients: 'Adicionar Clientes',
    canEditClients: 'Editar Clientes',
};

export default function TeamScreen() {
    const router = useRouter();
    const { auth, db } = getFirebase();

    const [team, setTeam] = useState<UserAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [accountId, setAccountId] = useState<string>('');
    const [expandedMember, setExpandedMember] = useState<string | null>(null);
    const [updatingPermission, setUpdatingPermission] = useState<string | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string>('');

    useEffect(() => {
        const loadAccountId = async () => {
            const user = auth.currentUser;
            if (user) {
                const token = await user.getIdTokenResult();
                setAccountId(token.claims.accountId as string || '');
                setCurrentUserId(user.uid);
            }
        };
        loadAccountId();
    }, []);

    useEffect(() => {
        if (!accountId) return;

        setLoading(true);
        const unsubscribe = getTeam(accountId, (data) => {
            const sorted = data.sort((a, b) => {
                const order = { superadmin: 0, owner: 1, admin: 2, viewer: 3 };
                return (order[a.role as keyof typeof order] || 4) - (order[b.role as keyof typeof order] || 4);
            });
            setTeam(sorted);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [accountId]);

    const toggleExpand = (memberId: string) => {
        setExpandedMember(expandedMember === memberId ? null : memberId);
    };

    const handlePermissionChange = async (member: UserAccount, permKey: keyof Permissions, value: boolean) => {
        if (!accountId || member.role === 'owner' || member.role === 'admin') return;

        const permissionId = `${member.id}-${permKey}`;
        setUpdatingPermission(permissionId);

        try {
            const newPermissions = { ...member.permissions, [permKey]: value };
            const result = await updateUserPermissionsAction(accountId, member.id, newPermissions);

            if (!result.success) {
                Alert.alert("Erro", result.error || "Falha ao atualizar permissão.");
            }
        } catch (error) {
            Alert.alert("Erro", "Ocorreu um erro ao atualizar permissão.");
        } finally {
            setUpdatingPermission(null);
        }
    };

    const renderPermissionGroup = (
        title: string,
        permissions: Partial<Record<keyof Permissions, string>>,
        member: UserAccount
    ) => {
        const isOwnerOrAdmin = member.role === 'owner' || member.role === 'admin';

        return (
            <View className="mb-4">
                <Text className="text-xs font-semibold text-gray-400 uppercase mb-2">{title}</Text>
                <View className="flex-row flex-wrap">
                    {(Object.keys(permissions) as Array<keyof typeof permissions>).map((key) => {
                        const permKey = key as keyof Permissions;
                        const label = permissions[key];
                        const isEnabled = member.permissions?.[permKey] ?? false;
                        const isUpdating = updatingPermission === `${member.id}-${permKey}`;

                        return (
                            <View key={key} className="w-1/2 flex-row items-center justify-between py-2 pr-4">
                                <Text className="text-sm text-gray-700 flex-1" numberOfLines={1}>{label}</Text>
                                {isUpdating ? (
                                    <ActivityIndicator size="small" color="#FF9500" />
                                ) : (
                                    <Switch
                                        value={isOwnerOrAdmin ? true : isEnabled}
                                        onValueChange={(value) => handlePermissionChange(member, permKey, value)}
                                        disabled={isOwnerOrAdmin}
                                        trackColor={{ false: '#D1D5DB', true: '#FDBA74' }}
                                        thumbColor={isEnabled ? '#FF9500' : '#f4f3f4'}
                                    />
                                )}
                            </View>
                        );
                    })}
                </View>
            </View>
        );
    };

    const renderMember = (member: UserAccount) => {
        const roleStyle = roleColors[member.role] || roleColors.viewer;
        const RoleIcon = roleStyle.icon;
        const isExpanded = expandedMember === member.id;
        const canEditPermissions = member.role === 'viewer' && member.id !== currentUserId;
        const isOwnerOrAdmin = member.role === 'owner' || member.role === 'admin';

        return (
            <Card key={member.id} className="mb-3">
                <CardContent className="pt-4 pb-4">
                    <TouchableOpacity
                        onPress={() => canEditPermissions && toggleExpand(member.id)}
                        activeOpacity={canEditPermissions ? 0.7 : 1}
                    >
                        <View className="flex-row items-start">
                            {/* Avatar */}
                            <View className="w-12 h-12 rounded-full bg-gray-200 items-center justify-center mr-3">
                                {member.avatarUrl ? (
                                    <Text className="text-gray-400 text-lg">
                                        {member.name?.charAt(0).toUpperCase()}
                                    </Text>
                                ) : (
                                    <User size={24} color="#9CA3AF" />
                                )}
                            </View>

                            {/* Info */}
                            <View className="flex-1">
                                <View className="flex-row items-center justify-between">
                                    <Text className="font-semibold text-gray-900 text-base">
                                        {member.name}
                                    </Text>
                                    <View className={`flex-row items-center px-2 py-1 rounded-full ${roleStyle.bg}`}>
                                        <RoleIcon size={12} color={member.role === 'owner' ? '#EA580C' : member.role === 'admin' ? '#2563EB' : '#6B7280'} />
                                        <Text className={`text-xs font-medium ml-1 ${roleStyle.text}`}>
                                            {roleLabels[member.role]}
                                        </Text>
                                    </View>
                                </View>

                                <View className="flex-row items-center mt-1">
                                    <Mail size={12} color="#6B7280" />
                                    <Text className="text-sm text-gray-500 ml-1">{member.email}</Text>
                                </View>

                                {member.phone && (
                                    <View className="flex-row items-center mt-1">
                                        <Phone size={12} color="#6B7280" />
                                        <Text className="text-sm text-gray-500 ml-1">{member.phone}</Text>
                                    </View>
                                )}

                                {/* Status */}
                                <View className="flex-row items-center mt-2">
                                    <View className={`w-2 h-2 rounded-full mr-2 ${member.status === 'ativo' ? 'bg-green-500' : 'bg-gray-400'
                                        }`} />
                                    <Text className={`text-xs ${member.status === 'ativo' ? 'text-green-600' : 'text-gray-500'
                                        }`}>
                                        {member.status === 'ativo' ? 'Ativo' : 'Inativo'}
                                    </Text>

                                    {canEditPermissions && (
                                        <View className="flex-row items-center ml-auto">
                                            <Text className="text-xs text-orange-600 mr-1">Permissões</Text>
                                            {isExpanded ? (
                                                <ChevronUp size={16} color="#EA580C" />
                                            ) : (
                                                <ChevronDown size={16} color="#EA580C" />
                                            )}
                                        </View>
                                    )}
                                </View>
                            </View>
                        </View>
                    </TouchableOpacity>

                    {/* Permissions Panel */}
                    {isExpanded && canEditPermissions && (
                        <View className="mt-4 pt-4 border-t border-gray-100">
                            {renderPermissionGroup('Acesso às Telas', screenPermissions, member)}
                            {renderPermissionGroup('Funcionalidades', featurePermissions, member)}
                            {renderPermissionGroup('Ações', actionPermissions, member)}
                        </View>
                    )}

                    {/* Owner/Admin Info */}
                    {isOwnerOrAdmin && isExpanded && (
                        <View className="mt-4 pt-4 border-t border-gray-100">
                            <View className="flex-row items-center bg-blue-50 p-3 rounded-lg">
                                <Shield size={16} color="#2563EB" />
                                <Text className="text-blue-800 text-sm ml-2">
                                    {member.role === 'owner'
                                        ? 'Proprietários têm acesso total.'
                                        : 'Admins herdam permissões do proprietário.'}
                                </Text>
                            </View>
                        </View>
                    )}
                </CardContent>
            </Card>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50" edges={['bottom']}>
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Equipe',
                    headerLeft: () => (
                        <TouchableOpacity onPress={() => router.back()} className="mr-2">
                            <ChevronLeft size={24} color="#171717" />
                        </TouchableOpacity>
                    ),
                }}
            />

            <ScrollView className="flex-1 px-4 pt-4">
                {/* Header Stats */}
                <View className="flex-row mb-4">
                    <View className="flex-1 bg-white rounded-xl p-4 mr-2 border border-gray-100">
                        <Text className="text-2xl font-bold text-gray-900">{team.length}</Text>
                        <Text className="text-sm text-gray-500">Membros</Text>
                    </View>
                    <View className="flex-1 bg-white rounded-xl p-4 ml-2 border border-gray-100">
                        <Text className="text-2xl font-bold text-green-600">
                            {team.filter(m => m.status === 'ativo').length}
                        </Text>
                        <Text className="text-sm text-gray-500">Ativos</Text>
                    </View>
                </View>

                {loading ? (
                    <View className="flex-1 items-center justify-center py-20">
                        <ActivityIndicator size="large" color="#FF9500" />
                    </View>
                ) : team.length === 0 ? (
                    <View className="flex-1 items-center justify-center py-20">
                        <User size={48} color="#D1D5DB" />
                        <Text className="text-gray-500 mt-4">Nenhum membro na equipe</Text>
                    </View>
                ) : (
                    <View className="pb-4">
                        {team.map(member => renderMember(member))}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
