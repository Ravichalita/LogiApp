
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


const formatCurrency = (value: number | undefined | null): string => {
    if (value === undefined || value === null) return '';
    const numberValue = Number(value);
    if (isNaN(numberValue)) return '';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numberValue);
};

const parseCurrency = (value: string): number => {
  if (!value) return 0;
  const numberString = value.replace(/\D/g, '');
  if (numberString === '') return 0;
  return parseFloat(numberString) / 100;
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
    // We pass accountId! because the form is only rendered when accountId exists
    const [state, formAction] = useActionState(updateRentalPricesAction.bind(null, accountId!), { error: null });

    // This local state holds the prices for editing
    const [prices, setPrices] = useState<RentalPrice[]>(account.rentalPrices || []);
    
    // This state will hold the raw string value from the input for each price item
    const [displayValues, setDisplayValues] = useState<Record<string, string>>(() => {
        const initialDisplayValues: Record<string, string> = {};
        (account.rentalPrices || []).forEach(p => {
            initialDisplayValues[p.id] = formatCurrency(p.value).replace('R$\xa0', '');
        });
        return initialDisplayValues;
    });

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
    
    const handlePriceValueChange = (id: string, value: string) => {
        // Allow only numbers and comma
        const rawValue = value.replace(/[^0-9,]/g, '');
        
        setDisplayValues(prev => ({ ...prev, [id]: rawValue }));

        // Update the actual numeric value in the prices state
        const numericValue = parseCurrency(rawValue.replace(',', '.'));
        setPrices(currentPrices =>
            currentPrices.map(p => (p.id === id ? { ...p, value: numericValue } : p))
        );
    };

    const handleNameChange = (id: string, name: string) => {
        setPrices(currentPrices =>
            currentPrices.map(p =>
                p.id === id ? { ...p, name: name } : p
            )
        )
    }

    const addPrice = () => {
        const newId = nanoid(5);
        setPrices(currentPrices => [...currentPrices, { id: newId, name: '', value: 0 }]);
        setDisplayValues(prev => ({...prev, [newId]: ''}));
    }
    
    const removePrice = (id: string) => {
        setPrices(currentPrices => currentPrices.filter(p => p.id !== id));
        setDisplayValues(prev => {
            const newDisplayValues = {...prev};
            delete newDisplayValues[id];
            return newDisplayValues;
        });
    }
    
    const customFormAction = (formData: FormData) => {
        // Clear previous formData and set the new one from our state
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
                                    onChange={e => handleNameChange(price.id, e.target.value)}
                                    required
                                />
                                <div className="relative">
                                     <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                                    <Input
                                        placeholder="0,00"
                                        value={displayValues[price.id] ?? ''}
                                        onChange={e => handlePriceValueChange(price.id, e.target.value)}
                                        className="pl-8"
                                        required
                                    />
                                </div>
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
