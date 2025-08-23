
'use client';

import { useEffect, useRef, useTransition } from 'react';
import { signupAction } from '@/lib/actions';
import { useAuth } from '@/context/auth-context';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle } from 'lucide-react';
import { DialogClose, DialogFooter } from '@/components/ui/dialog';

const initialState = {
  message: '',
  isInvite: true, // This form is always for invites
};

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? 'Convidando...' : 'Convidar Usuário'}
        </Button>
    )
}

export function InviteForm({ onSave }: { onSave?: () => void }) {
  const { accountId } = useAuth();
  const [state, formAction] = useActionState(signupAction.bind(null, accountId), initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  
  useEffect(() => {
    if (state.message === 'success') {
        toast({
          title: 'Convite Enviado!',
          description: 'O novo usuário foi adicionado e pode agora fazer login.',
        });
        formRef.current?.reset();
        onSave?.();
    } else if (state.message) {
      toast({
        title: 'Erro no Convite',
        description: state.message,
        variant: 'destructive',
      });
    }
  }, [state, toast, onSave]);

  return (
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
            <SubmitButton />
        </DialogFooter>
    </form>
  );
}
