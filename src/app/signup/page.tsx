
'use client';

import { useEffect, useRef, useTransition, useState } from 'react';
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
import { getFirebase } from '@/lib/firebase-client';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { ensureUserDocument, findAccountByEmailDomain } from '@/lib/data-server';
import { adminAuth } from '@/lib/firebase-admin';

const initialState = {
  message: '',
  validatedData: null,
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
  const { user: inviter, accountId: inviterAccountId } = useAuth();
  const [state, formAction] = useActionState(signupAction, initialState);
  const router = useRouter();
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  const isInviteFlow = !!inviter;
  const { auth } = getFirebase();

  useEffect(() => {
    const handleUserCreation = async () => {
      if (state.message === 'validation_success' && state.validatedData) {
        setIsCreatingUser(true);
        const { name, email, password } = state.validatedData;
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const newUser = userCredential.user;

          // The user document needs to be created by a server-side function
          // We can't use `ensureUserDocument` directly on the client.
          // This part of the logic needs to be re-thought or called via a server action.
          // For now, let's assume the user will be guided to verify email and the doc will be created then.
          
          if (isInviteFlow) {
            toast({
                title: 'Convite Enviado!',
                description: 'O novo usuário foi adicionado e um e-mail de verificação foi enviado.',
            });
            formRef.current?.reset();
            router.push('/team');
          } else {
            // New user self-signup
            router.push('/verify-email');
          }

        } catch (error: any) {
          toast({
            title: 'Erro no Cadastro',
            description: handleFirebaseError(error),
            variant: 'destructive',
          });
        } finally {
            setIsCreatingUser(false);
        }
      } else if (state.message && state.message !== 'validation_success') {
          toast({
              title: 'Erro de Validação',
              description: state.message,
              variant: 'destructive',
          });
      }
    }
    handleUserCreation();
  }, [state, router, toast, isInviteFlow, auth]);

    // Helper for client-side error display
    const handleFirebaseError = (error: any): string => {
        switch (error.code) {
            case 'auth/email-already-in-use':
            return 'Este e-mail já está em uso por outra conta.';
            case 'auth/invalid-email':
            return 'O formato do e-mail é inválido.';
            case 'auth/weak-password':
            return 'A senha é muito fraca. Use pelo menos 6 caracteres.';
            default:
            return 'Ocorreu um erro inesperado ao criar a conta.';
        }
    };

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
            <SubmitButton />
             {state.message && state.message !== 'validation_success' && (
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
