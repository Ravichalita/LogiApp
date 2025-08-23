
'use client';

import { useEffect, useRef, useState } from 'react';
import { signupAction } from '@/lib/actions';
import { useAuth } from '@/context/auth-context';
import { useActionState } from 'react-dom';
import { useFormStatus } from 'react-dom';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Copy, Share2 } from 'lucide-react';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const initialState = {
  message: '',
  isInvite: true,
  newUser: null as { name: string; email: string; password?: string } | null,
};

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? 'Convidando...' : 'Convidar Usuário'}
        </Button>
    )
}

function SuccessDialog({
    isOpen,
    onOpenChange,
    newUser,
    onClose,
}: {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    newUser: { name: string; email: string; password?: string } | null;
    onClose: () => void;
}) {
    const { toast } = useToast();
    const loginUrl = typeof window !== 'undefined' ? `${window.location.origin}/login` : '';

    if (!newUser) return null;
    
    const message = `Olá, ${newUser.name}! Bem-vindo(a) ao Econtrol.\n\nAqui estão seus dados de acesso:\n\n*Link de Acesso:* ${loginUrl}\n*E-mail:* ${newUser.email}\n*Senha Temporária:* ${newUser.password}\n\nRecomendamos alterar sua senha no primeiro acesso.`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            toast({ title: 'Copiado!', description: 'Dados de acesso copiados para a área de transferência.' });
        }).catch(err => {
            console.error('Falha ao copiar:', err);
            toast({ title: 'Erro', description: 'Não foi possível copiar os dados.', variant: 'destructive' });
        });
    }

    const handleDialogClose = (open: boolean) => {
        onOpenChange(open);
        if (!open) {
            onClose();
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleDialogClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Usuário Convidado com Sucesso!</DialogTitle>
                    <DialogDescription>
                        Compartilhe os detalhes de login com {newUser.name}.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div>
                        <Label>Link de Acesso</Label>
                        <p className="text-sm font-mono p-2 bg-muted rounded-md break-all">{loginUrl}</p>
                    </div>
                     <div>
                        <Label>E-mail</Label>
                        <p className="text-sm font-mono p-2 bg-muted rounded-md">{newUser.email}</p>
                    </div>
                     <div>
                        <Label>Senha Temporária</Label>
                        <p className="text-sm font-mono p-2 bg-muted rounded-md">{newUser.password}</p>
                    </div>
                </div>
                <DialogFooter className="gap-2 sm:justify-between">
                     <Button variant="outline" onClick={() => copyToClipboard(message)}>
                        <Copy className="mr-2" />
                        Copiar Tudo
                    </Button>
                    <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
                        <Button className="w-full">
                            <Share2 className="mr-2"/>
                           Compartilhar no WhatsApp
                        </Button>
                    </a>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export function InviteForm({ onSave }: { onSave?: () => void }) {
  const { accountId } = useAuth();
  const [state, formAction, isPending] = useActionState(signupAction.bind(null, accountId), initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false);
  
  useEffect(() => {
    if (state.message === 'success' && state.newUser) {
        toast({
          title: 'Convite Enviado!',
          description: `O usuário ${state.newUser.name} foi adicionado.`,
        });
        formRef.current?.reset();
        // Do not call onSave here, wait for the success dialog to be closed.
        setIsSuccessDialogOpen(true);
    } else if (state.message && state.message !== 'success') {
      toast({
        title: 'Erro no Convite',
        description: state.message,
        variant: 'destructive',
      });
    }
  }, [state, toast]);

  return (
    <>
    <form ref={formRef} action={formAction} className="space-y-4">
        <div className="space-y-2">
            <Label htmlFor="name">Nome Completo</Label>
            <Input id="name" name="name" type="text" placeholder="Nome do usuário" required />
        </div>
        <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" placeholder="usuario@email.com" required />
        </div>
        <div className="space-y-2">
            <Label htmlFor="password">Senha Temporária</Label>
            <Input id="password" name="password" type="password" required />
        </div>
        <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar Senha</Label>
            <Input id="confirmPassword" name="confirmPassword" type="password" required />
        </div>
        {state.message && state.message !== 'success' && (
            <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <p>{state.message}</p>
            </div>
        )}
        <DialogFooter>
            <DialogClose asChild>
                <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
                {isPending ? 'Convidando...' : 'Convidar Usuário'}
            </Button>
        </DialogFooter>
    </form>
    <SuccessDialog
        isOpen={isSuccessDialogOpen}
        onOpenChange={setIsSuccessDialogOpen}
        newUser={state.newUser}
        onClose={onSave!} // Call onSave only when the success dialog is closed.
    />
    </>
  );
}

    