
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/auth-context"
import { sendEmailVerification } from "firebase/auth"
import { useToast } from "@/hooks/use-toast"
import { MailCheck } from "lucide-react"

export default function VerifyEmailPage() {
    const { user, logout } = useAuth()
    const { toast } = useToast();

    const handleResendVerification = async () => {
        if (user) {
            try {
                await sendEmailVerification(user);
                toast({
                    title: 'E-mail enviado!',
                    description: 'Um novo link de verificação foi enviado para o seu e-mail.',
                });
            } catch (error) {
                toast({
                    title: 'Erro',
                    description: 'Não foi possível reenviar o e-mail de verificação. Tente novamente mais tarde.',
                    variant: 'destructive'
                });
            }
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <div className="mx-auto mb-4 bg-primary/10 text-primary rounded-full p-3 w-fit">
                        <MailCheck className="h-8 w-8" />
                    </div>
                    <CardTitle className="text-2xl font-bold">Verifique seu E-mail</CardTitle>
                    <CardDescription>
                       Enviamos um link de verificação para <strong>{user?.email}</strong>.
                       Por favor, clique no link para ativar sua conta.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                   <p className="text-sm text-muted-foreground">
                        Depois de verificar, atualize esta página ou faça login novamente.
                   </p>
                   <p className="text-sm text-muted-foreground">
                        Não recebeu o e-mail? Verifique sua pasta de spam ou clique abaixo para reenviar.
                   </p>
                    <div className="flex w-full items-center gap-4">
                        <Button variant="outline" className="w-full" onClick={logout}>Voltar para o Login</Button>
                        <Button className="w-full" onClick={handleResendVerification}>Reenviar E-mail</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
