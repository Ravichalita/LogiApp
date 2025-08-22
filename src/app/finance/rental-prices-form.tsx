
'use client';
import { useState, useEffect } from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { updateRentalPricesAction } from '@/lib/actions';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import type { Account, RentalPrice } from '@/lib/types';
import { PlusCircle, Trash2 } from 'lucide-react';
import { nanoid } from 'nanoid';


const formatCurrencyInput = (value: string | number): string => {
  if (value === '' || value === null || value === undefined) return '';
  let stringValue = String(value).replace(/\D/g, '');
  if (stringValue === '') return '';
  const numberValue = parseFloat(stringValue) / 100;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numberValue);
};

const parseCurrency = (value: string): number => {
  if (!value) return 0;
  return Number(value.replace('R$', '').replace(/\./g, '').replace(',', '.').trim());
}

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} className="w-full">
            {pending ? <Spinner size="small" /> : 'Salvar Preços'}
        </Button>
    )
}

export function RentalPricesForm({ account }: { account: Account }) {
    const { accountId } = useAuth();
    const { toast } = useToast();
    const [state, formAction] = useActionState(updateRentalPricesAction.bind(null, accountId!), { error: null });

    const [prices, setPrices] = useState<RentalPrice[]>(account.rentalPrices || []);
    
    useEffect(() => {
        if (state.message === 'success') {
            toast({
                title: 'Sucesso!',
                description: 'Tabela de preços atualizada.',
            });
        } else if (state.error) {
             toast({
                title: 'Erro',
                description: 'Não foi possível salvar os preços.',
                variant: 'destructive',
            });
        }
    }, [state, toast]);

    const handlePriceChange = (id: string, field: 'name' | 'value', value: string) => {
        setPrices(currentPrices =>
            currentPrices.map(p => {
                if (p.id === id) {
                    if (field === 'value') {
                        return { ...p, value: parseCurrency(formatCurrencyInput(value)) };
                    }
                    return { ...p, [field]: value };
                }
                return p;
            })
        );
    };

    const addPrice = () => {
        setPrices(currentPrices => [...currentPrices, { id: nanoid(5), name: '', value: 0 }]);
    }
    
    const removePrice = (id: string) => {
        setPrices(currentPrices => currentPrices.filter(p => p.id !== id));
    }
    
    const customFormAction = (formData: FormData) => {
        // Clear previous formData and set the new one
        for(let key of formData.keys()){
            formData.delete(key);
        }
        formData.set('rentalPrices', JSON.stringify(prices));
        formAction(formData);
    }

    return (
         <form action={customFormAction} className="space-y-4">
            <div className="space-y-3">
                <Label>Tabela de Preços da Diária</Label>
                {prices.length > 0 ? (
                    prices.map((price) => (
                        <div key={price.id} className="flex items-center gap-2 p-2 border rounded-md">
                        <div className="grid grid-cols-2 gap-2 flex-grow">
                                <Input
                                    placeholder="Nome (Ex: Padrão 5m³)"
                                    value={price.name}
                                    onChange={e => handlePriceChange(price.id, 'name', e.target.value)}
                                    required
                                />
                                <Input
                                    placeholder="R$ 0,00"
                                    value={formatCurrencyInput(price.value)}
                                    onChange={e => handlePriceChange(price.id, 'value', e.target.value)}
                                    required
                                />
                        </div>
                            <Button type="button" variant="ghost" size="icon" onClick={() => removePrice(price.id)} aria-label="Remover Preço">
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </div>
                    ))
                ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum preço cadastrado.</p>
                )}
                 <Button type="button" variant="outline" size="sm" className="w-full" onClick={addPrice}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Adicionar Novo Preço
                </Button>
            </div>
            <SubmitButton />
        </form>
    )
}
