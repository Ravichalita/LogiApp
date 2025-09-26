
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
    <main className="flex min-h-screen items-center justify-center bg-pattern p-4">
      <div className="relative z-10 w-full max-w-sm lg:max-w-4xl lg:grid lg:grid-cols-2 rounded-lg shadow-lg overflow-hidden bg-card/50 backdrop-blur-sm border border-white/20">
        {/* Branding Section - Left */}
        <div className="hidden lg:flex flex-col items-center justify-center bg-primary/80 p-12 text-primary-foreground">
          <Image src="/192x192.png" alt="LogiApp Logo" width={80} height={80} />
          <h1 className="text-3xl font-bold mt-4">LogiApp</h1>
          <p className="mt-2 text-center text-sm opacity-80">Gestão de Logistica Simplificada</p>
        </div>

        {/* Form Section - Right */}
        <div className="p-6 sm:p-8">
            <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
                 <div className="lg:hidden flex flex-col items-center mb-6">
                    <Image src="/192x192.png" alt="LogiApp Logo" width={48} height={48} />
                    <h1 className="text-2xl font-bold mt-2 text-primary">LogiApp</h1>
                 </div>
                <h2 className="text-2xl font-bold text-primary hidden lg:block">Login</h2>
                <p className="text-muted-foreground mt-2">Gestão de Logistica Simplificada</p>
            </div>
            
            <form onSubmit={handleLogin} className="space-y-4 mt-6">
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
          
            <div className="mt-6 text-center">
              <Button variant="link" size="sm" onClick={handlePasswordReset} disabled={isResetting || isSubmitting}>
                  {isResetting ? <Spinner size="small" /> : 'Esqueci minha senha'}
              </Button>
            </div>

            <div className="mt-4 text-center">
              <Link href="/privacy-policy" className="text-xs text-muted-foreground hover:text-primary hover:underline">
                  Política de Privacidade
              </Link>
            </div>
        </div>
      </div>
    </main>
  );
}
