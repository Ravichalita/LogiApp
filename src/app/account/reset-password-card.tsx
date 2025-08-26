
'use client';

import { useTransition } from 'react';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { getFirebase } from '@/lib/firebase-client';
import { sendPasswordResetEmail } from 'firebase/auth';
import { KeyRound } from 'lucide-react';

export function ResetPasswordCard() {
    const { user } = useAuth();
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const handleResetPassword = () => {
        const { auth } = getFirebase(); // Get auth instance here to ensure it's ready

        if (!auth) {
             toast({
                title: 'Erro',
                description: 'O serviço de autenticação não está disponível. Por favor, recarregue a página.',
                variant: 'destructive',
            });
            return;
        }

        if (!user?.email) {
            toast({
                title: 'Erro',
                description: 'E-mail do usuário não encontrado.',
                variant: 'destructive',
            });
            return;
        }

        startTransition(async () => {
            try {
                await sendPasswordResetEmail(auth, user.email!);
                toast({
                    title: 'E-mail Enviado!',
                    description: `Um link para redefinir sua senha foi enviado para ${user.email}.`,
                });
            } catch (error) {
                console.error("Password reset error:", error);
                toast({
                    title: 'Erro',
                    description: 'Não foi possível enviar o e-mail de redefinição. Por favor, tente novamente mais tarde.',
                    variant: 'destructive',
                });
            }
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <KeyRound className="h-5 w-5" />
                    Alterar Senha
                </CardTitle>
                <CardDescription>
                    Enviaremos um link para o seu e-mail para você poder criar uma nova senha.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Button onClick={handleResetPassword} disabled={isPending}>
                    {isPending ? <Spinner size="small" /> : 'Enviar Link de Redefinição'}
                </Button>
            </CardContent>
        </Card>
    );
}
