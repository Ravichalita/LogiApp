
'use client';

import { useEffect, useRef, useState, useActionState } from 'react';
import { signupAction } from '@/lib/actions';
import { useAuth } from '@/context/auth-context';
import { useFormStatus } from 'react-dom';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Copy, Share2, CheckCircle } from 'lucide-react';
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
    const loginUrl = "https://logi.app.br";

    if (!newUser) return null;
    
    const message = `Olá, ${newUser.name}! Bem-vindo(a) ao LogiApp.\n\nUse estes dados para seu primeiro acesso:\n\n*Link de Acesso:* ${loginUrl}\n\n*E-mail:* ${newUser.email}\n\n*Senha:* ${newUser.password}\n\n*Passo a Passo Para Começar:*\n\n*1- Instale o App:*\nAo acessar o link, clique no botão *"Instalar App"* para adicioná-lo à sua tela inicial.\n\n*2- Crie sua Nova Senha:*\nApós o login, um pop-up aparecerá. Clique no botão, verifique o e-mail que enviamos para você (lembre-se de checar a caixa de SPAM), clique no link e insira sua nova senha.\n\n*3- Ative as Notificações:*\nPara receber alertas importantes, permita o envio de notificações quando o app solicitar.`;

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
                    <DialogTitle className="flex items-center gap-2">
                        <CheckCircle className="h-6 w-6 text-green-500" />
                        Usuário Adicionado com Sucesso!
                    </DialogTitle>
                    <DialogDescription>
                        Compartilhe os detalhes de login com {newUser.name}.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 p-4">
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
                        <Copy className="mr-2 h-4 w-4" />
                        Copiar Tudo
                    </Button>
                    <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
                        <Button className="w-full">
                            <Share2 className="mr-2 h-4 w-4"/>
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
  const [state, formAction] = useActionState(signupAction.bind(null, accountId), initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordHint, setShowPasswordHint] = useState(false);
  
  useEffect(() => {
    if (state.message === 'success' && state.newUser) {
        toast({
          title: 'Convite Enviado!',
          description: `O usuário ${state.newUser.name} foi adicionado.`,
        });
        formRef.current?.reset();
        setPassword('');
        setConfirmPassword('');
        setShowPasswordHint(false);
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

  const handleEmailBlur = () => {
    // Only generate password if the fields are empty
    if (!password && !confirmPassword) {
      const randomPassword = Math.random().toString(36).slice(-8);
      setPassword(randomPassword);
      setConfirmPassword(randomPassword);
      setShowPasswordHint(true);
    }
  };

  return (
    <>
    <form ref={formRef} action={formAction} className="space-y-4">
        <div className="space-y-2">
            <Label htmlFor="name">Nome Completo</Label>
            <Input id="name" name="name" type="text" placeholder="Nome do usuário" required />
        </div>
        <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" placeholder="usuario@email.com" onBlur={handleEmailBlur} required />
        </div>
        <div className="space-y-2">
            <Label htmlFor="password">Senha Temporária</Label>
            <Input id="password" name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar Senha</Label>
            <Input id="confirmPassword" name="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
        </div>

        {showPasswordHint && (
            <p className="text-xs text-muted-foreground">
                Geramos uma sugestão de senha automaticamente para você. Mas você ainda pode mudar manualmente se quiser.
            </p>
        )}

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
    <SuccessDialog
        isOpen={isSuccessDialogOpen}
        onOpenChange={setIsSuccessDialogOpen}
        newUser={state.newUser}
        onClose={onSave!} // Call onSave only when the success dialog is closed.
    />
    </>
  );
}
