import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    Alert,
    TouchableOpacity,
    Platform,
    KeyboardAvoidingView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { ChevronLeft, User, Phone, Mail, MapPin, FileText, CreditCard } from 'lucide-react-native';

import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';

import { getFirebase } from '../../lib/firebase';
import { createClientAction } from '../../lib/actions';
import { doc, getDoc } from 'firebase/firestore';

export default function NewClientScreen() {
    const router = useRouter();
    const { auth, db } = getFirebase();

    // Form states
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [cpfCnpj, setCpfCnpj] = useState('');
    const [address, setAddress] = useState('');
    const [observations, setObservations] = useState('');

    // UI states
    const [submitting, setSubmitting] = useState(false);
    const [accountId, setAccountId] = useState<string>('');

    useEffect(() => {
        const loadAccountId = async () => {
            const user = auth.currentUser;
            if (user) {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    setAccountId(userDoc.data().accountId || '');
                }
            }
        };
        loadAccountId();
    }, []);

    // Format phone number
    const formatPhone = (text: string) => {
        // Remove non-digits
        const numbers = text.replace(/\D/g, '');

        // Apply mask: (XX) XXXXX-XXXX
        if (numbers.length <= 2) {
            return numbers;
        } else if (numbers.length <= 7) {
            return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
        } else if (numbers.length <= 11) {
            return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
        }
        return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
    };

    // Format CPF/CNPJ
    const formatCpfCnpj = (text: string) => {
        const numbers = text.replace(/\D/g, '');

        if (numbers.length <= 11) {
            // CPF: XXX.XXX.XXX-XX
            if (numbers.length <= 3) return numbers;
            if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
            if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
            return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9)}`;
        } else {
            // CNPJ: XX.XXX.XXX/XXXX-XX
            if (numbers.length <= 2) return numbers;
            if (numbers.length <= 5) return `${numbers.slice(0, 2)}.${numbers.slice(2)}`;
            if (numbers.length <= 8) return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5)}`;
            if (numbers.length <= 12) return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8)}`;
            return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8, 12)}-${numbers.slice(12, 14)}`;
        }
    };

    const validateEmail = (email: string) => {
        if (!email) return true; // Email is optional
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    };

    const handleSubmit = async () => {
        // Validations
        if (!name.trim()) {
            Alert.alert('Erro', 'O nome do cliente é obrigatório.');
            return;
        }

        if (!phone.trim()) {
            Alert.alert('Erro', 'O telefone é obrigatório.');
            return;
        }

        if (email && !validateEmail(email)) {
            Alert.alert('Erro', 'O email informado não é válido.');
            return;
        }

        if (!accountId) {
            Alert.alert('Erro', 'Conta não encontrada. Faça login novamente.');
            return;
        }

        setSubmitting(true);

        try {
            const result = await createClientAction(accountId, {
                name: name.trim(),
                phone: phone.trim(),
                email: email.trim() || undefined,
                cpfCnpj: cpfCnpj.trim() || undefined,
                address: address.trim() || undefined,
                observations: observations.trim() || undefined,
            });

            if (result.success) {
                Alert.alert('Sucesso', 'Cliente criado com sucesso!', [
                    { text: 'OK', onPress: () => router.back() }
                ]);
            } else {
                Alert.alert('Erro', result.error || 'Falha ao criar cliente.');
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Erro', 'Ocorreu um erro ao criar o cliente.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50" edges={['bottom']}>
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Novo Cliente',
                    headerLeft: () => (
                        <TouchableOpacity onPress={() => router.back()} className="mr-2">
                            <ChevronLeft size={24} color="#171717" />
                        </TouchableOpacity>
                    ),
                }}
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >
                <ScrollView
                    className="flex-1"
                    contentContainerStyle={{ padding: 16 }}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Name */}
                    <Card className="mb-4">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex-row items-center">
                                <User size={16} color="#FF9500" />
                                <Text className="ml-2 text-base font-semibold">Identificação</Text>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <View className="mb-4">
                                <Input
                                    label="Nome do Cliente *"
                                    placeholder="Nome completo ou razão social"
                                    value={name}
                                    onChangeText={setName}
                                    autoCapitalize="words"
                                />
                            </View>
                            <Input
                                label="CPF / CNPJ"
                                placeholder="000.000.000-00"
                                value={cpfCnpj}
                                onChangeText={(text) => setCpfCnpj(formatCpfCnpj(text))}
                                keyboardType="numeric"
                            />
                        </CardContent>
                    </Card>

                    {/* Contact */}
                    <Card className="mb-4">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex-row items-center">
                                <Phone size={16} color="#FF9500" />
                                <Text className="ml-2 text-base font-semibold">Contato</Text>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <View className="mb-4">
                                <Input
                                    label="Telefone *"
                                    placeholder="(00) 00000-0000"
                                    value={phone}
                                    onChangeText={(text) => setPhone(formatPhone(text))}
                                    keyboardType="phone-pad"
                                />
                            </View>
                            <Input
                                label="Email"
                                placeholder="email@exemplo.com"
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />
                        </CardContent>
                    </Card>

                    {/* Address */}
                    <Card className="mb-4">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex-row items-center">
                                <MapPin size={16} color="#FF9500" />
                                <Text className="ml-2 text-base font-semibold">Endereço</Text>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Input
                                placeholder="Endereço completo"
                                value={address}
                                onChangeText={setAddress}
                                multiline
                                numberOfLines={2}
                            />
                        </CardContent>
                    </Card>

                    {/* Observations */}
                    <Card className="mb-4">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex-row items-center">
                                <FileText size={16} color="#FF9500" />
                                <Text className="ml-2 text-base font-semibold">Observações</Text>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Input
                                placeholder="Observações adicionais (opcional)"
                                value={observations}
                                onChangeText={setObservations}
                                multiline
                                numberOfLines={3}
                            />
                        </CardContent>
                    </Card>

                    {/* Submit Button */}
                    <Button
                        className="mt-4 mb-8 bg-orange-500"
                        onPress={handleSubmit}
                        loading={submitting}
                    >
                        Cadastrar Cliente
                    </Button>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
