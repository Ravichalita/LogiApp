
'use client';
import { useState, useEffect } from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { updateDefaultPriceAction } from '@/lib/actions';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import type { Account } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';


const formatCurrencyInput = (value: number | string | undefined | null) => {
    if (value === undefined || value === null) return '';
    if (typeof value === 'number') {
        value = value.toFixed(2);
    }
    let inputValue = String(value).replace(/\D/g, '');
    if (!inputValue) return '';
    const numberValue = Number(inputValue) / 100;
    // Handle the case where input is "0" -> should become "R$ 0,00"
    if (numberValue === 0) {
      return 'R$ 0,00';
    }
    return numberValue.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
};

const parseCurrency = (value: string): number => {
  if (!value) return 0;
  return Number(value.replace('R$', '').replace(/\./g, '').replace(',', '.').trim());
}

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} className="w-full">
            {pending ? <Spinner size="small" /> : 'Salvar Preço Padrão'}
        </Button>
    )
}

export function DefaultPriceForm({ account }: { account: Account }) {
    const { accountId } = useAuth();
    const { toast } = useToast();
    const [state, formAction] = useActionState(updateDefaultPriceAction.bind(null, accountId!), { error: null });

    const [price, setPrice] = useState(formatCurrencyInput(account.defaultRentalValue || ''));
    
    useEffect(() => {
        if (state.message === 'success') {
            toast({
                title: 'Sucesso!',
                description: 'Preço padrão atualizado.',
            });
        } else if (state.error) {
             toast({
                title: 'Erro',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast]);

    const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPrice(formatCurrencyInput(e.target.value));
    };

    return (
         <form action={formAction} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="defaultRentalValue">Preço Padrão da Diária</Label>
                <Input
                    id="defaultRentalValue"
                    name="defaultRentalValue"
                    value={price}
                    onChange={handlePriceChange}
                    placeholder="R$ 0,00"
                />
                 {state?.error && (
                    <Alert variant="destructive" className="mt-2 text-xs p-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{state.error}</AlertDescription>
                    </Alert>
                )}
            </div>
            <SubmitButton />
        </form>
    )
}
