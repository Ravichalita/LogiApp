
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
import { Truck, AlertCircle, UserPlus, ArrowLeft } from 'lucide-react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useAuth } from '@/context/auth-context';

const initialState = {
  message: '',
  isInvite: false,
};

function SubmitButton() {
    const { pending } = useFormStatus();
    const { user: inviter } = useAuth();
    const isInvite = !!inviter;

    return (
        <Button type="submit" disabled={pending} className="w-full">
            {pending ? (isInvite ? 'Convidando...' : 'Criando conta...') : (isInvite ? 'Convidar Usuário' : 'Criar Conta')}
        </Button>
    )
}

export default function SignupPage() {
  const { user: inviter, accountId: inviterAccountId } = useAuth();
  const [state, formAction] = useActionState(signupAction.bind(null, inviterAccountId), initialState);
  const router = useRouter();
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  const isInviteFlow = !!inviter;

  useEffect(() => {
    if (state.message === 'success') {
      if (state.isInvite) {
        toast({
          title: 'Convite Enviado!',
          description: 'O novo usuário foi adicionado e pode agora fazer login.',
        });
        formRef.current?.reset();
        router.push('/team'); // Redirect back to the team page
      } else {
        toast({
          title: 'Conta Criada!',
          description: 'Sua conta foi criada. Faça login para continuar.',
        });
        router.push('/login'); // Redirect new users to login
      }
    } else if (state.message) {
      toast({
        title: isInviteFlow ? 'Erro no Convite' : 'Erro de Cadastro',
        description: state.message,
        variant: 'destructive',
      });
    }
  }, [state, router, toast, isInviteFlow]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm relative">
        {isInviteFlow && (
            <Button variant="ghost" size="icon" className="absolute top-4 left-4" onClick={() => router.back()}>
                <ArrowLeft className="h-5 w-5" />
                <span className="sr-only">Voltar</span>
            </Button>
        )}
        <CardHeader className="text-center pt-12">
           <div className="mx-auto mb-4">
                {isInviteFlow ? <UserPlus className="h-10 w-10 text-primary" /> : <Truck className="h-10 w-10 text-primary" />}
            </div>
          <CardTitle className="text-2xl font-bold">{isInviteFlow ? 'Convidar Usuário' : 'Criar Conta'}</CardTitle>
          <CardDescription>
            {isInviteFlow 
                ? 'Preencha os dados do novo membro da equipe.'
                : 'Cadastre-se para começar a gerenciar suas caçambas.'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form ref={formRef} action={formAction} className="space-y-4">
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
                placeholder={isInviteFlow ? "Senha temporária" : "Crie uma senha"}
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
            <div className="flex flex-col gap-2 pt-2">
                 <SubmitButton />
                 {isInviteFlow && (
                    <Button type="button" variant="outline" onClick={() => router.back()}>
                        Cancelar
                    </Button>
                 )}
            </div>
             {state.message && state.message !== 'success' && (
              <div className="flex items-center gap-2 text-sm text-destructive pt-2">
                <AlertCircle className="h-4 w-4" />
                <p>{state.message}</p>
              </div>
            )}
          </form>
        </CardContent>
        {!isInviteFlow && (
            <CardFooter>
                <p className="text-sm text-center w-full text-muted-foreground">
                    Já tem uma conta?{' '}
                    <Link href="/login" className="font-medium text-primary hover:underline">
                        Faça login
                    </Link>
                </p>
            </CardFooter>
        )}
      </Card>
    </div>
  );
}
