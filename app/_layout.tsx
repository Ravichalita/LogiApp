import "../global.css";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { AuthProvider, useAuth } from "../context/auth";

function RootLayoutNav() {
    const { user, loading } = useAuth();
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        if (loading) return;

        const inAuthGroup = segments[0] === "(auth)";

        if (!user && !inAuthGroup) {
            router.replace("/(auth)/login");
        } else if (user && inAuthGroup) {
            router.replace("/(tabs)");
        }
    }, [user, loading, segments]);

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center bg-zinc-100">
                <ActivityIndicator size="large" color="#FF9500" />
            </View>
        );
    }

    return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
    return (
        <AuthProvider>
            <RootLayoutNav />
        </AuthProvider>
    );
}
