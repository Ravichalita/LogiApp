
'use client';

import { useEffect, useRef, useState } from 'react';
import { signupAction } from '@/lib/actions';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Truck, AlertCircle } from 'lucide-react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

const initialState = {
  message: '',
  isInvite: false,
};

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} className="w-full">
            {pending ? 'Criando conta...' : 'Criar Conta'}
        </Button>
    )
}

export default function SignupPage() {
  const [state, formAction] = useActionState(signupAction.bind(null, null), initialState);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (state.message === 'success') {
        toast({
          title: 'Conta Criada!',
          description: 'Sua conta foi criada. Faça login para continuar.',
        });
        router.push('/login');
    } else if (state.message) {
      toast({
        title: 'Erro de Cadastro',
        description: state.message,
        variant: 'destructive',
      });
    }
  }, [state, router, toast]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm relative">
        <CardHeader className="text-center">
           <div className="mx-auto mb-4">
                <Truck className="h-10 w-10 text-primary" />
            </div>
          <CardTitle className="text-2xl font-bold">Criar Conta</CardTitle>
          <CardDescription>
            Cadastre-se para começar a gerenciar suas caçambas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Completo</Label>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="Nome do usuário"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="usuario@email.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder={"Crie uma senha"}
                required
              />
            </div>
             <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Senha</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Confirme a senha"
                required
              />
            </div>
             {state.message && state.message !== 'success' && (
              <div className="flex items-center gap-2 text-sm text-destructive pt-2">
                <AlertCircle className="h-4 w-4" />
                <p>{state.message}</p>
              </div>
            )}
            <div className="pt-2">
                 <SubmitButton />
            </div>
            
          </form>
        </CardContent>
        <CardFooter>
            <p className="text-sm text-center w-full text-muted-foreground">
                Já tem uma conta?{' '}
                <Link href="/login" className="font-medium text-primary hover:underline">
                    Faça login
                </Link>
            </p>
        </CardFooter>
      </Card>
    </div>
  );
}
