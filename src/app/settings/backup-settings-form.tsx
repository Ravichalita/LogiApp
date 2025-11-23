
'use client';
import { useEffect } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { updateBackupSettingsAction } from '@/lib/actions';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import type { Account } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';


function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <Spinner size="small" /> : 'Salvar Configurações'}
        </Button>
    )
}

const initialState = {
    message: null,
    error: null,
}

export function BackupSettingsForm({ account }: { account: Account }) {
    const { accountId } = useAuth();
    const { toast } = useToast();
    const [state, formAction] = useFormState(updateBackupSettingsAction.bind(null, accountId!), initialState);

    useEffect(() => {
        if (state.message === 'success') {
            toast({
                title: 'Sucesso!',
                description: 'Configurações de backup atualizadas.',
            });
        } else if (state.error) {
             toast({
                title: 'Erro',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast]);

    return (
         <form action={formAction} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="backupPeriodicityDays">Frequência (dias)</Label>
                    <Input 
                        id="backupPeriodicityDays" 
                        name="backupPeriodicityDays"
                        type="number"
                        defaultValue={account.backupPeriodicityDays || 7}
                        required
                    />
                     <p className="text-xs text-muted-foreground">A cada quantos dias um novo backup será criado.</p>
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="backupRetentionDays">Retenção (dias)</Label>
                    <Input 
                        id="backupRetentionDays" 
                        name="backupRetentionDays"
                        type="number"
                        defaultValue={account.backupRetentionDays || 90}
                        required
                    />
                    <p className="text-xs text-muted-foreground">Backups mais antigos que isso serão excluídos.</p>
                </div>
            </div>
             {state?.error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {state.error}
                </AlertDescription>
              </Alert>
            )}
            <SubmitButton />
        </form>
    )
}
