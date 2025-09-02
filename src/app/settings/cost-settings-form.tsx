
'use client';
import { useEffect, useTransition, useState, useRef } from 'react';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import type { Account } from '@/lib/types';
import { updateCostSettingsAction } from '@/lib/actions';
import { Save } from 'lucide-react';

const formatCurrencyForInput = (valueInCents: string): string => {
    if (!valueInCents) return '0,00';
    const numericValue = parseInt(valueInCents.replace(/\D/g, ''), 10) || 0;
    const reais = Math.floor(numericValue / 100);
    const centavos = (numericValue % 100).toString().padStart(2, '0');
    return `${reais.toLocaleString('pt-BR')},${centavos}`;
};

export function CostSettingsForm({ account }: { account: Account }) {
    const { accountId } = useAuth();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const [displayValue, setDisplayValue] = useState<string>(() => {
        return (account.costPerKm ? account.costPerKm * 100 : 0).toFixed(0);
    });

    // To prevent saving on every render if the value hasn't changed
    const savedValue = useRef(displayValue);

    const handleSave = () => {
        // Only save if the value has actually changed
        if (!accountId || isPending || displayValue === savedValue.current) {
            return;
        }

        startTransition(async () => {
            const formData = new FormData();
            formData.set('costPerKm', displayValue);
            const result = await updateCostSettingsAction(accountId, formData);
             if (result.message === 'error') {
                 toast({
                    title: 'Erro ao Salvar',
                    description: result.error,
                    variant: 'destructive',
                });
            } else {
                 toast({
                    title: 'Salvo!',
                    description: 'Custo por Km atualizado com sucesso.',
                });
                savedValue.current = displayValue;
            }
        });
    };
    
    const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const cents = e.target.value.replace(/\D/g, '');
        setDisplayValue(cents);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSave();
            (e.target as HTMLInputElement).blur(); // Remove focus after Enter
        }
    }

    return (
        <form onSubmit={(e) => e.preventDefault()} className="space-y-2">
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                <Input
                    id="costPerKm"
                    name="costPerKm"
                    placeholder="0,00"
                    value={formatCurrencyForInput(displayValue)}
                    onChange={handleValueChange}
                    onBlur={handleSave}
                    onKeyDown={handleKeyDown}
                    className="pl-8 text-right"
                    required
                />
                 {isPending && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Spinner size="small" />
                    </div>
                )}
            </div>
        </form>
    )
}
