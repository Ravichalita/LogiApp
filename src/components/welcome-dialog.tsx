
'use client';

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

interface WelcomeDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function WelcomeDialog({ isOpen, onOpenChange }: WelcomeDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
                 <KeyRound className="h-8 w-8 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-center">Bem-vindo(a) ao LogiApp!</DialogTitle>
          <DialogDescription className="text-center">
            Sua conta foi criada com uma senha temporária. Para sua segurança, recomendamos que você a altere agora.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 text-sm text-muted-foreground space-y-4">
          <p>
            Você pode alterar sua senha a qualquer momento na página {" "}
            <Link href="/account" className="font-bold text-primary hover:underline" onClick={() => onOpenChange(false)}>
              Sua Conta
            </Link>.
          </p>
          <div className="flex items-start gap-3 p-3 rounded-md bg-destructive/10 border border-destructive/20">
             <MailWarning className="h-6 w-6 text-destructive mt-1 flex-shrink-0" />
            <p className="text-destructive/90">
              <span className="font-bold">Importante:</span> Ao solicitar a redefinição de senha, o e-mail pode ir para sua caixa de <span className="font-bold">Spam</span> ou <span className="font-bold">Lixo Eletrônico</span>. Verifique-as!
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="w-full">Entendido, começar a usar!</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
