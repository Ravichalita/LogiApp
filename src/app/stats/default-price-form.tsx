
'use client';

import { useEffect, useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { updateDefaultPriceAction } from '@/lib/actions';
import type { Account } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from '@/components/ui/spinner';
import { AlertCircle } from 'lucide-react';

const formatCurrencyInput = (value: number | string) => {
    if (typeof value === 'number') {
        value = value.toFixed(2);
    }
    let inputValue = String(value).replace(/\D/g, '');
     if (!inputValue) return '';
    inputValue = (Number(inputValue) / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
    return inputValue;
};

const parseCurrency = (value: string): number | undefined => {
    if (!value) return undefined;
    const numberValue = Number(value.replace('R$', '').replace(/\./g, '').replace(',', '.'));
    return isNaN(numberValue) ? undefined : numberValue;
}

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <Spinner size="small" /> : 'Salvar Preço Padrão'}
        </Button>
    )
}

export function DefaultPriceForm({ account }: { account: Account }) {
    const { accountId } = useAuth();
    const { toast } = useToast();
    const [state, formAction] = useFormState(updateDefaultPriceAction.bind(null, accountId!), { error: null });

    const [price, setPrice] = useState(formatCurrencyInput(account.defaultRentalValue || ''));
    
    useEffect(() => {
        setPrice(formatCurrencyInput(account.defaultRentalValue || ''));
    }, [account.defaultRentalValue])
    
    useEffect(() => {
        if (state?.message === 'success') {
            toast({
                title: 'Sucesso!',
                description: 'Preço padrão da diária atualizado.',
            });
        } else if (state?.error) {
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

    const handleFormAction = (formData: FormData) => {
        const parsedValue = parseCurrency(formData.get('defaultRentalValue') as string);
        const newFormData = new FormData();
        if(parsedValue !== undefined) {
             newFormData.append('defaultRentalValue', String(parsedValue));
        }
        formAction(newFormData);
    }

    return (
        <form action={handleFormAction} className="flex items-end gap-4">
            <div className="w-full max-w-xs space-y-2">
                <Label htmlFor="defaultRentalValue">Valor (R$)</Label>
                <Input
                    id="defaultRentalValue"
                    name="defaultRentalValue"
                    value={price}
                    onChange={handlePriceChange}
                    placeholder="R$ 0,00"
                />
                 {state?.error && (
                    <div className="flex items-center gap-2 text-sm text-destructive pt-1">
                        <AlertCircle className="h-4 w-4" />
                        <p>{state.error}</p>
                    </div>
                )}
            </div>
            <SubmitButton />
        </form>
    );
}
