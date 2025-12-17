import { View, ActivityIndicator } from "react-native";
import { useEffect, useState } from "react";
import { useRouter, Slot } from "expo-router";
import { getFirebase } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function RootLayout() {
    const router = useRouter();
    const { auth } = getFirebase();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setLoading(false);
            if (!currentUser) {
                // If not authenticated, go to login
                // We need to use replace to avoid back button going back to splash
                // Using setImmediate to avoid some mounting race conditions in RN
                setImmediate(() => router.replace("/login"));
            } else {
                // If authenticated, go to tabs
                setImmediate(() => router.replace("/(tabs)"));
            }
        });

        return () => unsubscribe();
    }, []);

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center bg-white">
                <ActivityIndicator size="large" color="#2563EB" />
            </View>
        );
    }

    return <Slot />;
}
