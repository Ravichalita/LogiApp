'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { getFirebase } from '@/lib/firebase-client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from '@/components/ui/spinner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from '@/components/ui/label';

export function HeaderLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { auth } = getFirebase();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    if (!auth) return;

    setIsSubmitting(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/os');
    } catch (error: any) {
      let errorMessage = 'Ocorreu um erro desconhecido.';
      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/invalid-credential':
          errorMessage = 'E-mail ou senha inválidos.';
          break;
        case 'auth/invalid-email':
            errorMessage = 'Formato de e-mail inválido.';
            break;
        case 'auth/too-many-requests':
            errorMessage = 'Muitas tentativas. Tente mais tarde.';
            break;
        default:
          errorMessage = 'Falha ao fazer login.';
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

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
        toast({
            title: 'E-mail Necessário',
            description: 'Digite seu e-mail para redefinir a senha.',
            variant: 'destructive'
        });
        return;
    }
    if (!auth) return;

    setIsResetting(true);
    try {
        await sendPasswordResetEmail(auth, resetEmail);
        toast({
            title: 'Link Enviado!',
            description: `Um link para redefinir a senha foi enviado para ${resetEmail}.`,
        });
        setIsForgotPasswordOpen(false);
    } catch (error: any) {
        let errorMessage = 'Erro ao enviar e-mail.';
         if (error.code === 'auth/invalid-email') {
            errorMessage = 'E-mail inválido.';
        } else if (error.code === 'auth/user-not-found') {
            errorMessage = 'E-mail não encontrado.';
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
    <div className="flex flex-col md:flex-row items-center gap-2 w-full md:w-auto">
      <form onSubmit={handleLogin} className="flex flex-col md:flex-row items-stretch md:items-center gap-2 w-full">
        <Input
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-9 w-full md:w-48 bg-background"
          aria-label="Email"
        />
        <Input
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-9 w-full md:w-48 bg-background"
           aria-label="Senha"
        />
        <Button type="submit" size="sm" disabled={isSubmitting} className="h-9 px-4 whitespace-nowrap">
          {isSubmitting ? <Spinner size="small" className="mr-2" /> : null}
          Entrar
        </Button>
      </form>

      <Dialog open={isForgotPasswordOpen} onOpenChange={setIsForgotPasswordOpen}>
        <DialogTrigger asChild>
             <Button variant="link" size="sm" className="text-xs text-muted-foreground h-auto p-0 md:ml-2 whitespace-nowrap">
                Esqueci a senha
            </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Redefinir Senha</DialogTitle>
                <DialogDescription>
                    Digite seu e-mail para receber um link de redefinição de senha.
                </DialogDescription>
            </DialogHeader>
            <form onSubmit={handlePasswordReset} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="reset-email">E-mail</Label>
                    <Input
                        id="reset-email"
                        type="email"
                        placeholder="seu@email.com"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        required
                    />
                </div>
                <div className="flex justify-end">
                    <Button type="submit" disabled={isResetting}>
                         {isResetting && <Spinner size="small" className="mr-2" />}
                         Enviar Link
                    </Button>
                </div>
            </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
