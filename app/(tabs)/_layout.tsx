import { Tabs } from 'expo-router';
import { Home, ClipboardList, Users, MoreHorizontal } from 'lucide-react-native';
import { View } from 'react-native';

export default function TabLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: '#FF9500', // orange primary
                tabBarInactiveTintColor: '#6B7280', // gray-500
                tabBarStyle: {
                    borderTopWidth: 1,
                    borderTopColor: '#E5E7EB', // gray-200
                    height: 60,
                    paddingBottom: 8,
                    paddingTop: 8,
                },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Início',
                    tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="os"
                options={{
                    title: 'Serviços',
                    tabBarIcon: ({ color, size }) => <ClipboardList size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="clients"
                options={{
                    title: 'Clientes',
                    tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="finance"
                options={{
                    title: 'Financeiro',
                    tabBarIcon: ({ color, size }) => <Users size={size} color={color} />, // Placeholder icon, change to DollarSign if available or Wallet
                }}
            />
            <Tabs.Screen
                name="more"
                options={{
                    title: 'Mais',
                    tabBarIcon: ({ color, size }) => <MoreHorizontal size={size} color={color} />,
                }}
            />
        </Tabs>
    );
}
