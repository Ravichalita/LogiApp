import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import {
    ArrowLeft,
    FileText,
    Share2,
    Calendar,
    Container,
    Truck,
    Users,
    DollarSign,
    TrendingUp
} from 'lucide-react-native';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { getFirebase } from '../../lib/firebase';
import { Card, CardContent } from '../../components/ui/card';

interface ReportData {
    totalRentals: number;
    activeRentals: number;
    completedRentals: number;
    totalOperations: number;
    activeOperations: number;
    completedOperations: number;
    totalClients: number;
    newClientsThisMonth: number;
    totalRevenue: number;
    monthlyRevenue: number;
}

export default function ReportsScreen() {
    const router = useRouter();
    const { auth, db } = getFirebase();

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<ReportData>({
        totalRentals: 0,
        activeRentals: 0,
        completedRentals: 0,
        totalOperations: 0,
        activeOperations: 0,
        completedOperations: 0,
        totalClients: 0,
        newClientsThisMonth: 0,
        totalRevenue: 0,
        monthlyRevenue: 0
    });
    const [selectedMonth, setSelectedMonth] = useState(new Date());

    const loadReportData = async () => {
        if (!auth.currentUser) return;

        try {
            const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
            if (!userDoc.exists()) return;

            const accountId = userDoc.data().accountId;

            const monthStart = startOfMonth(selectedMonth);
            const monthEnd = endOfMonth(selectedMonth);

            // Load rentals
            const rentalsSnap = await getDocs(collection(db, `accounts/${accountId}/rentals`));
            let totalRentals = 0;
            let activeRentals = 0;
            let completedRentals = 0;
            let rentalRevenue = 0;
            let monthlyRentalRevenue = 0;

            rentalsSnap.docs.forEach(doc => {
                const d = doc.data();
                totalRentals++;
                const status = d.status || 'Pendente';
                if (status === 'Ativo') activeRentals++;
                if (status === 'Finalizado' || status === 'Concluído') completedRentals++;

                const value = d.value || 0;
                rentalRevenue += value;

                const rentalDate = d.rentalDate ? new Date(d.rentalDate) : null;
                if (rentalDate && isWithinInterval(rentalDate, { start: monthStart, end: monthEnd })) {
                    monthlyRentalRevenue += value;
                }
            });

            // Load operations
            const operationsSnap = await getDocs(collection(db, `accounts/${accountId}/operations`));
            let totalOperations = 0;
            let activeOperations = 0;
            let completedOperations = 0;
            let operationRevenue = 0;
            let monthlyOperationRevenue = 0;

            operationsSnap.docs.forEach(doc => {
                const d = doc.data();
                totalOperations++;
                const status = d.status || 'Pendente';
                if (status === 'Em Andamento') activeOperations++;
                if (status === 'Finalizado' || status === 'Concluído') completedOperations++;

                const value = d.value || 0;
                operationRevenue += value;

                const startDate = d.startDate ? new Date(d.startDate) : null;
                if (startDate && isWithinInterval(startDate, { start: monthStart, end: monthEnd })) {
                    monthlyOperationRevenue += value;
                }
            });

            // Load clients
            const clientsSnap = await getDocs(collection(db, `accounts/${accountId}/clients`));
            let totalClients = clientsSnap.size;
            let newClientsThisMonth = 0;

            clientsSnap.docs.forEach(doc => {
                const d = doc.data();
                const createdAt = d.createdAt?.toDate ? d.createdAt.toDate() : new Date(d.createdAt);
                if (isWithinInterval(createdAt, { start: monthStart, end: monthEnd })) {
                    newClientsThisMonth++;
                }
            });

            setData({
                totalRentals,
                activeRentals,
                completedRentals,
                totalOperations,
                activeOperations,
                completedOperations,
                totalClients,
                newClientsThisMonth,
                totalRevenue: rentalRevenue + operationRevenue,
                monthlyRevenue: monthlyRentalRevenue + monthlyOperationRevenue
            });

        } catch (error) {
            console.error('Error loading report:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadReportData();
    }, [selectedMonth]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(value);
    };

    // Generate HTML for PDF
    const generateHtml = () => {
        const monthName = format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR });

        return `
            <html>
              <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
                <style>
                  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
                  h1 { color: #F97316; font-size: 24px; margin-bottom: 5px; }
                  h2 { font-size: 18px; margin-top: 20px; border-bottom: 2px solid #F3F4F6; padding-bottom: 8px; color: #4B5563; }
                  .header { text-align: center; margin-bottom: 30px; }
                  .period { font-size: 16px; color: #6B7280; }
                  .stat-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #F3F4F6; }
                  .stat-label { font-weight: 500; }
                  .stat-value { font-weight: bold; color: #111827; }
                  .highlight { color: #F97316; }
                  .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #9CA3AF; }
                  .card { background: #F9FAFB; padding: 15px; border-radius: 8px; margin-bottom: 15px; }
                  .total-rev { font-size: 24px; color: #059669; font-weight: bold; }
                </style>
              </head>
              <body>
                <div class="header">
                  <h1>Relatório LogiApp</h1>
                  <div class="period">${monthName.toUpperCase()}</div>
                </div>

                <div class="card" style="background: #ECFDF5; border: 1px solid #D1FAE5;">
                  <div style="font-size: 14px; color: #059669; margin-bottom: 5px;">RECEITA DO MÊS</div>
                  <div class="total-rev">${formatCurrency(data.monthlyRevenue)}</div>
                  <div style="font-size: 12px; color: #059669; margin-top: 5px;">Total Acumulado: ${formatCurrency(data.totalRevenue)}</div>
                </div>

                <h2>📦 Aluguéis de Caçamba</h2>
                <div class="stat-row">
                  <span class="stat-label">Total no período</span>
                  <span class="stat-value">${data.totalRentals}</span>
                </div>
                <div class="stat-row">
                  <span class="stat-label">Ativos agora</span>
                  <span class="stat-value">${data.activeRentals}</span>
                </div>
                <div class="stat-row">
                  <span class="stat-label">Finalizados</span>
                  <span class="stat-value highlight">${data.completedRentals}</span>
                </div>

                <h2>🚛 Operações</h2>
                <div class="stat-row">
                  <span class="stat-label">Total no período</span>
                  <span class="stat-value">${data.totalOperations}</span>
                </div>
                <div class="stat-row">
                  <span class="stat-label">Em andamento</span>
                  <span class="stat-value">${data.activeOperations}</span>
                </div>
                <div class="stat-row">
                  <span class="stat-label">Concluídas</span>
                  <span class="stat-value highlight">${data.completedOperations}</span>
                </div>

                <h2>👥 Clientes</h2>
                <div class="stat-row">
                  <span class="stat-label">Total cadastrado</span>
                  <span class="stat-value">${data.totalClients}</span>
                </div>
                <div class="stat-row">
                  <span class="stat-label">Novos este mês</span>
                  <span class="stat-value">${data.newClientsThisMonth}</span>
                </div>

                <div class="footer">
                  Gerado automaticamente em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}
                  <br/>Chalita Digital - LogiApp
                </div>
              </body>
            </html>
        `;
    };

    const handleShare = async () => {
        try {
            setLoading(true);
            const html = generateHtml();
            const { uri } = await Print.printToFileAsync({ html });
            await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
        } catch (error) {
            console.error('Error generating PDF:', error);
            Alert.alert('Erro', 'Não foi possível gerar o PDF.');
        } finally {
            setLoading(false);
        }
    };

    const handleExport = () => {
        Alert.alert(
            'Exportar Relatório',
            'Deseja gerar o relatório em PDF?',
            [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Gerar PDF', onPress: handleShare }
            ]
        );
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
                <ActivityIndicator size="large" color="#FF9500" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-gray-50" edges={['bottom']}>
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Relatórios',
                    headerLeft: () => (
                        <TouchableOpacity onPress={() => router.back()} className="mr-2">
                            <ArrowLeft size={24} color="#171717" />
                        </TouchableOpacity>
                    ),
                    headerRight: () => (
                        <TouchableOpacity onPress={handleShare} className="ml-2">
                            <Share2 size={22} color="#FF9500" />
                        </TouchableOpacity>
                    ),
                }}
            />

            <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
                {/* Month Selector */}
                <View className="flex-row items-center justify-between mb-6">
                    <View>
                        <Text className="text-gray-500 text-sm">Período</Text>
                        <Text className="text-xl font-bold text-gray-900">
                            {format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR })}
                        </Text>
                    </View>
                    <View className="flex-row items-center bg-gray-100 rounded-full">
                        <TouchableOpacity
                            className="px-4 py-2"
                            onPress={() => setSelectedMonth(new Date(selectedMonth.setMonth(selectedMonth.getMonth() - 1)))}
                        >
                            <Text className="text-gray-700">←</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            className="px-4 py-2"
                            onPress={() => setSelectedMonth(new Date(selectedMonth.setMonth(selectedMonth.getMonth() + 1)))}
                        >
                            <Text className="text-gray-700">→</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Revenue Card */}
                <Card className="mb-4 bg-gradient-to-r from-green-500 to-green-600 bg-green-500 border-0">
                    <CardContent className="pt-6 pb-6">
                        <View className="flex-row items-center mb-2">
                            <DollarSign size={20} color="rgba(255,255,255,0.8)" />
                            <Text className="text-green-100 ml-2">Receita do Mês</Text>
                        </View>
                        <Text className="text-white text-3xl font-bold">
                            {formatCurrency(data.monthlyRevenue)}
                        </Text>
                        <Text className="text-green-100 text-sm mt-2">
                            Total acumulado: {formatCurrency(data.totalRevenue)}
                        </Text>
                    </CardContent>
                </Card>

                {/* OS Stats */}
                <View className="flex-row gap-4 mb-4">
                    <Card className="flex-1">
                        <CardContent className="pt-4 pb-4">
                            <View className="flex-row items-center mb-2">
                                <Container size={18} color="#FF9500" />
                                <Text className="text-gray-500 text-sm ml-2">Aluguéis</Text>
                            </View>
                            <Text className="text-2xl font-bold text-gray-900">{data.totalRentals}</Text>
                            <View className="flex-row mt-2">
                                <Text className="text-blue-500 text-xs">{data.activeRentals} ativos</Text>
                                <Text className="text-gray-300 mx-1">•</Text>
                                <Text className="text-green-500 text-xs">{data.completedRentals} finalizados</Text>
                            </View>
                        </CardContent>
                    </Card>
                    <Card className="flex-1">
                        <CardContent className="pt-4 pb-4">
                            <View className="flex-row items-center mb-2">
                                <Truck size={18} color="#3B82F6" />
                                <Text className="text-gray-500 text-sm ml-2">Operações</Text>
                            </View>
                            <Text className="text-2xl font-bold text-gray-900">{data.totalOperations}</Text>
                            <View className="flex-row mt-2">
                                <Text className="text-blue-500 text-xs">{data.activeOperations} em andamento</Text>
                                <Text className="text-gray-300 mx-1">•</Text>
                                <Text className="text-green-500 text-xs">{data.completedOperations} concluídas</Text>
                            </View>
                        </CardContent>
                    </Card>
                </View>

                {/* Clients Stats */}
                <Card className="mb-4">
                    <CardContent className="pt-4 pb-4">
                        <View className="flex-row items-center justify-between">
                            <View className="flex-row items-center">
                                <View className="w-10 h-10 bg-purple-100 rounded-full items-center justify-center mr-3">
                                    <Users size={20} color="#8B5CF6" />
                                </View>
                                <View>
                                    <Text className="text-gray-500 text-sm">Clientes</Text>
                                    <Text className="text-xl font-bold text-gray-900">{data.totalClients}</Text>
                                </View>
                            </View>
                            {data.newClientsThisMonth > 0 && (
                                <View className="bg-green-100 px-3 py-1 rounded-full flex-row items-center">
                                    <TrendingUp size={14} color="#16A34A" />
                                    <Text className="text-green-600 font-medium ml-1">
                                        +{data.newClientsThisMonth} este mês
                                    </Text>
                                </View>
                            )}
                        </View>
                    </CardContent>
                </Card>

                {/* Export Button */}
                <TouchableOpacity
                    className="bg-orange-500 rounded-xl py-4 items-center flex-row justify-center mb-8"
                    onPress={handleExport}
                >
                    <FileText size={20} color="#FFFFFF" />
                    <Text className="text-white font-semibold ml-2">Gerar Relatório</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}
