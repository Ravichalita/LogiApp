
'use client';
import { useState, useEffect, useTransition } from 'react';
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


const formatCurrencyForInput = (valueInCents: string): string => {
    if (!valueInCents) return '0,00';
    const numericValue = parseInt(valueInCents.replace(/\D/g, ''), 10) || 0;
    const reais = Math.floor(numericValue / 100);
    const centavos = (numericValue % 100).toString().padStart(2, '0');
    return `${reais.toLocaleString('pt-BR')},${centavos}`;
};


export function RentalPricesForm({ account }: { account: Account }) {
    const { accountId } = useAuth();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const [prices, setPrices] = useState<RentalPrice[]>(account.rentalPrices || []);
    
    const [displayValues, setDisplayValues] = useState<Record<string, string>>(() => {
        const initialDisplayValues: Record<string, string> = {};
        (account.rentalPrices || []).forEach(p => {
            initialDisplayValues[p.id] = (p.value * 100).toFixed(0);
        });
        return initialDisplayValues;
    });

    const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!accountId) return;

        startTransition(async () => {
            const result = await updateRentalPricesAction(accountId, prices);
             if (result.message === 'error') {
                 toast({
                    title: 'Erro ao Salvar',
                    description: 'Não foi possível salvar os preços. Verifique os dados e tente novamente.',
                    variant: 'destructive',
                });
            } else {
                 toast({
                    title: 'Salvo!',
                    description: 'Tabela de preços atualizada com sucesso.',
                });
            }
        });
    };
    
    const handlePriceValueChange = (id: string, value: string) => {
        const cents = value.replace(/\D/g, '');
        setDisplayValues(prev => ({ ...prev, [id]: cents }));
        
        const numericValue = parseInt(cents, 10) || 0;
        setPrices(currentPrices =>
            currentPrices.map(p => (p.id === id ? { ...p, value: numericValue / 100 } : p))
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
        setDisplayValues(prev => ({...prev, [newId]: '0'}));
    }
    
    const removePrice = (id: string) => {
        setPrices(currentPrices => currentPrices.filter(p => p.id !== id));
        setDisplayValues(prev => {
            const newDisplayValues = {...prev};
            delete newDisplayValues[id];
            return newDisplayValues;
        });
    }

    return (
        <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="space-y-3">
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
                                        value={formatCurrencyForInput(displayValues[price.id] ?? '0')}
                                        onChange={e => handlePriceValueChange(price.id, e.target.value)}
                                        className="pl-8 text-right"
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
             <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? <Spinner size="small" /> : 'Salvar Preços'}
            </Button>
        </form>
    )
}
