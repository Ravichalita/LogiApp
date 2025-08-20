'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Truck } from 'lucide-react';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? 'Entrando...' : 'Entrar'}
    </Button>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
       if (!userCredential.user.emailVerified) {
         router.push('/verify-email');
         return;
       }
      router.push('/');
    } catch (error: any) {
      let errorMessage = 'Ocorreu um erro desconhecido.';
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'Nenhum usuário encontrado com este e-mail.';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Senha incorreta. Por favor, tente novamente.';
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
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
       <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
            <div className="mx-auto mb-4">
                <Truck className="h-10 w-10 text-primary" />
            </div>
          <CardTitle className="text-2xl font-bold">Login</CardTitle>
          <CardDescription>Acesse sua conta CaçambaControl</CardDescription>
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
            <SubmitButton />
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
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
