
'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { getFirebase } from '@/lib/firebase-client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Truck } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
       <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
            <div className="mx-auto mb-4">
                <Truck className="h-10 w-10 text-primary" />
            </div>
          <CardTitle className="text-2xl font-bold">Login</CardTitle>
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
             <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="hidden flex-col gap-4">
             <p className="text-sm text-center text-muted-foreground">
                Não tem uma conta?{' '}
                <Link href="/signup" className="font-medium text-primary hover:underline">
                    Cadastre-se
                </Link>
            </p>
        </CardFooter>
      </Card>
    </div>
  );
}
