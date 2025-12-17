import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { getFirebase } from "../../lib/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "expo-router";

export default function Dashboard() {
    const { auth } = getFirebase();
    const router = useRouter();

    const handleLogout = async () => {
        await signOut(auth);
        router.replace('/login');
    }

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <ScrollView contentContainerClassName="p-6 space-y-6">
                <View className="flex-row items-center justify-between mb-2">
                    <View>
                        <Text className="text-2xl font-bold text-gray-900">Olá, Usuário</Text>
                        <Text className="text-gray-500">Visão geral da sua operação</Text>
                    </View>
                    <Button variant="ghost" onPress={handleLogout}>Sair</Button>
                </View>

                <View className="flex-row gap-4">
                    <Card className="flex-1 bg-blue-50 border-blue-100">
                        <CardHeader className="p-4">
                            <CardTitle className="text-blue-700 text-3xl">12</CardTitle>
                            <CardDescription className="text-blue-600/80">OS Ativas</CardDescription>
                        </CardHeader>
                    </Card>
                    <Card className="flex-1 bg-orange-50 border-orange-100">
                        <CardHeader className="p-4">
                            <CardTitle className="text-orange-700 text-3xl">5</CardTitle>
                            <CardDescription className="text-orange-600/80">Pendentes</CardDescription>
                        </CardHeader>
                    </Card>
                </View>

                <Card>
                    <CardHeader>
                        <CardTitle>Ações Rápidas</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-row flex-wrap gap-2">
                        <Button variant="outline" className="grow">Nova OS</Button>
                        <Button variant="outline" className="grow">Novo Cliente</Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Últimas Atividades</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Text className="text-gray-500 text-center py-4">Nenhuma atividade recente</Text>
                    </CardContent>
                </Card>

            </ScrollView>
        </SafeAreaView>
    );
}
