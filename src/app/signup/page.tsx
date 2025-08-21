
'use client';

import { useEffect, useRef } from 'react';
import { signupAction } from '@/lib/actions';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Truck, AlertCircle, UserPlus } from 'lucide-react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useAuth } from '@/context/auth-context';

const initialState = {
  message: '',
};

function SubmitButton() {
    const { pending } = useFormStatus();
    const { user } = useAuth();
    const isInvite = !!user;

    return (
        <Button type="submit" disabled={pending} className="w-full">
            {pending ? (isInvite ? 'Convidando...' : 'Criando conta...') : (isInvite ? 'Convidar Usuário' : 'Criar Conta')}
        </Button>
    )
}

export default function SignupPage() {
  const { user } = useAuth();
  const [state, formAction] = useActionState(signupAction, initialState);
  const router = useRouter();
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  const isInviteFlow = !!user;

  useEffect(() => {
    if (state.message === 'success') {
         toast({
            title: 'Sucesso!',
            description: 'Sua conta foi criada. Redirecionando para o login...',
        });
        router.push('/login');
    } else if (state.message === 'invite_success') {
        toast({
            title: 'Convite Enviado!',
            description: 'O novo usuário foi adicionado à equipe e um e-mail de verificação foi enviado.',
        });
        formRef.current?.reset(); // Clear the form
        router.push('/team');
    } else if (state.message) {
        toast({
            title: 'Erro no Cadastro',
            description: state.message,
            variant: 'destructive',
        });
    }
  }, [state, router, toast]);


  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
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
            {/* Hidden input to pass inviter's ID if in invite flow */}
            {isInviteFlow && <input type="hidden" name="inviterId" value={user.uid} />}
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
                placeholder="Senha temporária"
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
            <SubmitButton />
             {state.message && !state.message.includes('success') && (
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
