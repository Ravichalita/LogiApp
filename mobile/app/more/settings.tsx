import { View, Text, Alert, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { ArrowLeft, LogOut, Info } from "lucide-react-native";
import { getFirebase } from "../../lib/firebase";
import { signOut } from "firebase/auth";
import { Button } from "../../components/ui/button";

export default function SettingsScreen() {
    const router = useRouter();
    const { auth } = getFirebase();

    const handleLogout = async () => {
        try {
            await signOut(auth);
            router.replace("/login");
        } catch (error) {
            console.error("Logout error:", error);
            Alert.alert("Erro", "Falha ao sair da conta.");
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <Stack.Screen options={{ headerShown: false }} />

            <View className="px-4 py-3 bg-white border-b border-gray-200 flex-row items-center">
                <TouchableOpacity onPress={() => router.back()} className="mr-3">
                    <ArrowLeft size={24} color="#1F2937" />
                </TouchableOpacity>
                <Text className="text-lg font-bold text-gray-900">Configurações</Text>
            </View>

            <View className="p-4 space-y-4">
                <View className="bg-white rounded-lg p-4 border border-gray-200">
                    <Text className="text-lg font-semibold mb-4">Conta</Text>
                    {auth.currentUser && (
                        <View className="mb-4">
                            <Text className="text-gray-500 text-sm">Logado como</Text>
                            <Text className="text-gray-900 font-medium">{auth.currentUser.email}</Text>
                        </View>
                    )}

                    <Button
                        variant="ghost"
                        onPress={handleLogout}
                        className="flex-row justify-start pl-0 text-red-600"
                    >
                        <LogOut size={20} color="#DC2626" className="mr-2" />
                        <Text className="text-red-600 font-semibold ml-2">Sair da Conta</Text>
                    </Button>
                </View>

                <View className="bg-white rounded-lg p-4 border border-gray-200 items-center">
                    <Info size={32} color="#9CA3AF" className="mb-2" />
                    <Text className="text-gray-900 font-bold">LogiApp Mobile</Text>
                    <Text className="text-gray-500 text-sm">Versão 1.0.0 (Build 100)</Text>
                    <Text className="text-gray-400 text-xs mt-2 text-center">
                        Desenvolvido por Chalita Digital
                        {'\n'}Todos os direitos reservados
                    </Text>
                </View>
            </View>
        </SafeAreaView>
    );
}
