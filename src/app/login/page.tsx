
'use client';

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
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/');
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
       <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
            <div className="mx-auto mb-4">
                <svg viewBox="0 0 60 60" className="h-10 w-10 fill-current text-primary">
                    <path d="M46.69,19.23l-16.87-9.73c-.97-.56-2.17-.56-3.14,0l-8.43,4.87c-.54.31-.51,1.08.04,1.39,0,0,.01,0,.02,0l17.38,9.86c1,.57,1.62,1.63,1.62,2.78v19.65s0,.01,0,.02c0,.66.68,1.1,1.26.76l8.12-4.69c.97-.56,1.57-1.6,1.57-2.72v-19.48c0-1.12-.6-2.16-1.58-2.72ZM56.24,18.81c0-2.02-1.09-3.91-2.84-4.92L31.09,1.01c-1.75-1.01-3.93-1.01-5.68,0L3.1,13.9c-1.75,1.01-2.84,2.9-2.84,4.92v25.76c0,2.02,1.1,3.91,2.85,4.92l22.31,12.88c.88.51,1.86.76,2.84.76.98,0,1.97-.25,2.84-.76l22.31-12.89c1.75-1.01,2.84-2.9,2.84-4.92v-25.76ZM51.88,46.84l-22.31,12.89c-.81.47-1.81.47-2.62,0l-22.31-12.88c-.81-.47-1.31-1.34-1.31-2.27v-25.76c0-.93.49-1.8,1.3-2.27L26.93,3.66c.4-.23.86-.35,1.31-.35.45,0,.91.12,1.31.35l22.31,12.88c.81.47,1.31,1.34,1.31,2.27v25.76c0,.93-.49-1.8-1.3,2.27Z"/>
                </svg>
            </div>
          <CardTitle className="text-2xl font-bold text-primary">Login</CardTitle>
          <CardDescription>Acesse sua conta para gerenciar seus aluguéis.</CardDescription>
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
    </div>
  );
}
