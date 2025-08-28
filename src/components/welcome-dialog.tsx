
'use client';

import { useState, useTransition } from 'react';
import { useAuth } from '@/context/auth-context';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { KeyRound, MailWarning } from 'lucide-react';
import Link from 'next/link';
import { getFirebase } from '@/lib/firebase-client';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from './ui/spinner';

interface WelcomeDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WelcomeDialog({ isOpen, onClose }: WelcomeDialogProps) {
    const { user } = useAuth();
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const handleResetPassword = () => {
        const { auth } = getFirebase();
        if (!auth || !user?.email) {
            toast({
                title: 'Erro',
                description: 'Não foi possível encontrar o e-mail do usuário para redefinir a senha.',
                variant: 'destructive',
            });
            return;
        }

        startTransition(async () => {
            try {
                await sendPasswordResetEmail(auth, user.email!);
                toast({
                    title: 'E-mail Enviado!',
                    description: (
                        <div>
                            <p>Um link para redefinir sua senha foi enviado para <strong>{user.email}</strong>.</p>
                            <p className="font-bold mt-2">Verifique sua caixa de spam!</p>
                        </div>
                    ),
                });
                onClose(); // Close dialog after sending the email
            } catch (error) {
                 toast({
                    title: 'Erro ao Enviar',
                    description: 'Não foi possível enviar o e-mail de redefinição. Tente novamente mais tarde.',
                    variant: 'destructive',
                });
            }
        });
    }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="p-0">
        <DialogHeader className="p-6 pb-2">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
                 <KeyRound className="h-8 w-8 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-center text-2xl font-headline">Bem-vindo(a)!</DialogTitle>
          <DialogDescription className="text-center pt-2">
            Sua conta foi criada com uma senha temporária. Para sua segurança, recomendamos que você a altere agora. Ao clicar no link que você receberá, basta inserir sua nova senha.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-4 text-sm text-muted-foreground space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-md bg-destructive/10 border border-destructive/20">
             <MailWarning className="h-6 w-6 text-destructive mt-1 flex-shrink-0" />
            <p className="text-destructive/90">
              <span className="font-bold">Importante:</span> Ao solicitar a redefinição, o e-mail pode ir para sua caixa de <span className="font-bold">Spam</span> ou <span className="font-bold">Lixo Eletrônico</span>.
            </p>
          </div>
        </div>
        <DialogFooter className="flex-col-reverse sm:flex-row p-6 bg-muted/50 rounded-b-lg">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">Lembrar Depois</Button>
          <Button onClick={handleResetPassword} disabled={isPending} className="w-full sm:w-auto">
              {isPending ? <Spinner size="small" /> : 'Enviar Link de Redefinição'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
