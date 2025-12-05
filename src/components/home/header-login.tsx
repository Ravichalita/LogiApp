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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from '@/components/ui/label';
import { LogIn } from 'lucide-react';

interface LoginFormFieldsProps {
    email: string;
    setEmail: (value: string) => void;
    password: string;
    setPassword: (value: string) => void;
    isSubmitting: boolean;
    isMobile?: boolean;
}

const LoginFormFields = ({ email, setEmail, password, setPassword, isSubmitting, isMobile = false }: LoginFormFieldsProps) => (
    <div className={`flex ${isMobile ? 'flex-col gap-3' : 'flex-row items-center gap-2'}`}>
       <Input
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`h-9 bg-background ${isMobile ? 'w-full' : 'w-48'}`}
          aria-label="Email"
        />
        <Input
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={`h-9 bg-background ${isMobile ? 'w-full' : 'w-48'}`}
           aria-label="Senha"
        />
        <Button type="submit" size="sm" disabled={isSubmitting} className={`h-9 px-4 whitespace-nowrap ${isMobile ? 'w-full' : ''}`}>
          {isSubmitting ? <Spinner size="small" className="mr-2" /> : null}
          Entrar
        </Button>
    </div>
);

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

  const ForgotPasswordLink = ({ className }: { className?: string }) => (
    <Dialog open={isForgotPasswordOpen} onOpenChange={setIsForgotPasswordOpen}>
        <DialogTrigger asChild>
             <Button variant="link" size="sm" className={`text-xs text-muted-foreground h-auto p-0 whitespace-nowrap ${className}`}>
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
  );

  return (
    <>
      {/* Desktop View */}
      <div className="hidden md:flex flex-row items-center gap-2">
         <form onSubmit={handleLogin} className="flex flex-row items-center gap-2">
            <LoginFormFields
                email={email}
                setEmail={setEmail}
                password={password}
                setPassword={setPassword}
                isSubmitting={isSubmitting}
            />
         </form>
         <ForgotPasswordLink className="ml-2" />
      </div>

      {/* Mobile View */}
      <div className="md:hidden">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon">
              <LogIn className="h-6 w-6" />
              <span className="sr-only">Login</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 mr-4">
             <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                   <h4 className="font-medium leading-none">Acessar Conta</h4>
                   <p className="text-sm text-muted-foreground">
                     Entre com suas credenciais para continuar.
                   </p>
                </div>
                <LoginFormFields
                    email={email}
                    setEmail={setEmail}
                    password={password}
                    setPassword={setPassword}
                    isSubmitting={isSubmitting}
                    isMobile={true}
                />
                <div className="flex justify-center">
                    <ForgotPasswordLink />
                </div>
             </form>
          </PopoverContent>
        </Popover>
      </div>
    </>
  );
}
