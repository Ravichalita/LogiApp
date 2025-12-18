import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    ActivityIndicator,
    TouchableOpacity,
    Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { ChevronLeft, User, Shield, Eye, Crown, Mail, Phone } from 'lucide-react-native';

import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { getFirebase } from '../../lib/firebase';
import { getTeam } from '../../lib/data';
import { UserAccount } from '../../lib/types';

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

export default function TeamScreen() {
    const router = useRouter();
    const { auth } = getFirebase();

    const [team, setTeam] = useState<UserAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [accountId, setAccountId] = useState<string>('');

    useEffect(() => {
        const loadAccountId = async () => {
            const user = auth.currentUser;
            if (user) {
                const token = await user.getIdTokenResult();
                setAccountId(token.claims.accountId as string || '');
            }
        };
        loadAccountId();
    }, []);

    useEffect(() => {
        if (!accountId) return;

        setLoading(true);
        const unsubscribe = getTeam(accountId, (data) => {
            // Sort: owners first, then admins, then viewers
            const sorted = data.sort((a, b) => {
                const order = { superadmin: 0, owner: 1, admin: 2, viewer: 3 };
                return (order[a.role] || 4) - (order[b.role] || 4);
            });
            setTeam(sorted);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [accountId]);

    const renderMember = (member: UserAccount) => {
        const roleStyle = roleColors[member.role] || roleColors.viewer;
        const RoleIcon = roleStyle.icon;

        return (
            <Card key={member.id} className="mb-3">
                <CardContent className="pt-4 pb-4">
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
                                    <RoleIcon size={12} color={roleStyle.text.replace('text-', '#').replace('-800', '')} />
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
                            </View>
                        </View>
                    </View>
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
