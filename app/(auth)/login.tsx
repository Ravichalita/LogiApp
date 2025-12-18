import { useState } from 'react';
import { View, ActivityIndicator, Alert } from 'react-native';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { useRouter } from 'expo-router';
import { getFirebase } from '../../lib/firebase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../../components/ui/card';
import { Label } from '../../components/ui/label';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { auth } = getFirebase();

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Erro', 'Por favor, preencha todos os campos.');
            return;
        }

        setLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            router.replace('/(tabs)');
        } catch (error: any) {
            console.error(error);
            let errorMessage = 'Falha ao fazer login.';
            if (error.code === 'auth/invalid-credential') {
                errorMessage = 'E-mail ou senha inválidos.';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Formato de e-mail inválido.';
            }
            Alert.alert('Erro de Login', errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        if (!email) {
            Alert.alert('Erro', 'Digite seu e-mail para redefinir a senha.');
            return;
        }
        try {
            await sendPasswordResetEmail(auth, email);
            Alert.alert('Sucesso', 'Link de redefinição enviado para o seu e-mail.');
        } catch (error: any) {
            Alert.alert('Erro', 'Não foi possível enviar o e-mail.');
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-zinc-100 items-center justify-center p-4">
            <Card className="w-full max-w-sm">
                <CardHeader className="items-center pb-2">
                    <View className="mb-4">
                        {/* Logo with orange primary color */}
                        <View className="w-20 h-20 bg-orange-500 rounded-xl items-center justify-center shadow-sm">
                            <Label className="text-zinc-900 text-3xl font-bold">L</Label>
                        </View>
                    </View>
                    <CardTitle className="text-2xl font-bold text-orange-500">LogiApp</CardTitle>
                    <CardDescription>Gestão de Logística Simplificada</CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 pt-4">
                    <Input
                        label="E-mail"
                        placeholder="seu@email.com"
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                    />

                    <Input
                        label="Senha"
                        placeholder="Sua senha"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        autoCapitalize="none"
                    />
                </CardContent>

                <CardFooter className="flex-col space-y-4 pt-2">
                    <Button className="w-full bg-orange-500" onPress={handleLogin} loading={loading}>
                        Entrar
                    </Button>

                    <Button variant="link" size="sm" onPress={handleForgotPassword}>
                        Esqueci minha senha
                    </Button>
                </CardFooter>
            </Card>
        </SafeAreaView>
    );
}
