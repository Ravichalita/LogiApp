import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Truck, Trash2, Settings, ChevronRight, Users } from "lucide-react-native";
import { getFirebase } from "../../lib/firebase";

export default function MoreOptions() {
    const router = useRouter();
    const { auth } = getFirebase();

    const menuItems = [
        {
            icon: Truck,
            label: "Frota",
            description: "Gerenciar caminhões e veículos",
            route: "/more/fleet",
            color: "#059669"
        },
        {
            icon: Trash2,
            label: "Caçambas",
            description: "Inventário de caçambas",
            route: "/more/dumpsters",
            color: "#D97706"
        },
        // Using Clients here again just as an example of menu, but it's already in tabs
        // Adding Settings
        {
            icon: Settings,
            label: "Configurações",
            description: "Preferências e conta",
            route: "/more/settings",
            color: "#4B5563"
        }
    ];

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <View className="px-6 py-4 bg-white border-b border-gray-200">
                <Text className="text-2xl font-bold text-gray-900">Mais Opções</Text>
                {auth.currentUser && (
                    <Text className="text-gray-500 text-sm mt-1">{auth.currentUser.email}</Text>
                )}
            </View>

            <ScrollView className="flex-1 p-4">
                <View className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
                    {menuItems.map((item, index) => (
                        <View key={item.label}>
                            <TouchableOpacity
                                className="flex-row items-center p-4 active:bg-gray-50"
                                onPress={() => router.push(item.route as any)}
                            >
                                <View className={`w-10 h-10 rounded-full items-center justify-center bg-gray-50`} style={{ backgroundColor: `${item.color}20` }}>
                                    <item.icon size={20} color={item.color} />
                                </View>

                                <View className="flex-1 ml-4">
                                    <Text className="text-base font-semibold text-gray-900">{item.label}</Text>
                                    <Text className="text-sm text-gray-500">{item.description}</Text>
                                </View>

                                <ChevronRight size={20} color="#9CA3AF" />
                            </TouchableOpacity>
                            {index < menuItems.length - 1 && <View className="h-[1px] bg-gray-100 ml-16" />}
                        </View>
                    ))}
                </View>

                <View className="mt-6 px-4">
                    <Text className="text-center text-gray-400 text-xs">Versão 1.0.0 (Beta)</Text>
                    <Text className="text-center text-gray-400 text-xs mt-1">Chalita Digital</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
