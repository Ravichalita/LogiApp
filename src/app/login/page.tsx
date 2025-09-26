
'use client';

import Image from "next/image";
import { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { getFirebase } from '@/lib/firebase-client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Spinner } from '@/components/ui/spinner';
import { recoverSuperAdminAction } from "@/lib/actions";

const SUPER_ADMIN_EMAIL = 'contato@econtrol.com.br';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { auth } = getFirebase();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Recovery logic specifically for the super admin
    if (email === SUPER_ADMIN_EMAIL) {
        try {
            await recoverSuperAdminAction();
            toast({ title: 'Tudo pronto!', description: 'Conta de Super Admin verificada. Tentando login...' });
        } catch (recoveryError) {
             toast({
                title: 'Erro na Recuperação',
                description: 'Não foi possível verificar a conta de Super Admin. O login pode falhar.',
                variant: 'destructive',
            });
        }
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/os');
    } catch (error: any) {
      let errorMessage = 'Ocorreu um erro desconhecido.';
      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/invalid-credential':
          errorMessage = 'E-mail ou senha inválidos. Por favor, tente novamente.';
          break;
        case 'auth/invalid-email':
            errorMessage = 'O formato do e-mail é inválido.';
            break;
        default:
          errorMessage = 'Falha ao fazer login. Verifique suas credenciais.';
          break;
      }
      toast({
        title: 'Erro de Login',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) {
        toast({
            title: 'E-mail Necessário',
            description: 'Por favor, digite seu e-mail no campo acima para redefinir a senha.',
            variant: 'destructive'
        });
        return;
    }
    setIsResetting(true);
    try {
        await sendPasswordResetEmail(auth, email);
        toast({
            title: 'Link Enviado!',
            description: (
                <div>
                    <p>Um link para redefinir a senha foi enviado para {email}.</p>
                    <p className="font-bold text-base mt-2">Não se esqueça de verificar sua caixa de spam.</p>
                </div>
            )
        });
    } catch (error: any) {
        let errorMessage = 'Não foi possível enviar o e-mail de redefinição.';
         if (error.code === 'auth/invalid-email') {
            errorMessage = 'O formato do e-mail é inválido.';
        } else if (error.code === 'auth/user-not-found') {
            errorMessage = 'Nenhuma conta encontrada com este e-mail.';
        }
        toast({
            title: 'Erro',
            description: errorMessage,
            variant: 'destructive'
        });
    } finally {
        setIsResetting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
              <div className="mx-auto mb-1">
                  <Link href="/" className="mr-6 flex items-center space-x-2">
                  </Link>
                  <Image src="/192x192.png" alt="LogiApp Logo" width={40} height={40} />
              </div>
            <CardTitle className="text-2xl font-bold text-primary">Login</CardTitle>
            </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={isSubmitting || isResetting} className="w-full">
                {isSubmitting ? <Spinner size="small" /> : 'Entrar'}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex-col gap-4 text-center">
              <Button variant="link" size="sm" onClick={handlePasswordReset} disabled={isResetting || isSubmitting}>
                  {isResetting ? <Spinner size="small" /> : 'Esqueci minha senha'}
              </Button>
          </CardFooter>
        </Card>
        <div className="mt-4">
          <Link href="/privacy-policy" className="text-xs text-muted-foreground hover:text-primary hover:underline">
              Política de Privacidade
          </Link>
        </div>
      </div>
    </div>
  );
}
