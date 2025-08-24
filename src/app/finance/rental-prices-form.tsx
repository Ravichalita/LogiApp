
'use client';
import { useState, useEffect, useTransition, useCallback } from 'react';
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
import { useDebouncedCallback } from 'use-debounce';


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

    const debouncedUpdate = useDebouncedCallback((newPrices: RentalPrice[]) => {
        if (!accountId) return;
        startTransition(async () => {
            const result = await updateRentalPricesAction(accountId, newPrices);
            if (result.message === 'error') {
                 toast({
                    title: 'Erro de Sincronização',
                    description: 'Não foi possível salvar as alterações. Verifique sua conexão e tente novamente.',
                    variant: 'destructive',
                });
                // TODO: Consider reverting state on error
            } else {
                 toast({
                    title: 'Salvo!',
                    description: 'Tabela de preços atualizada.',
                });
            }
        })
    }, 1000); // Debounce time of 1 second

    useEffect(() => {
        // Prevent initial trigger on component mount
        if(JSON.stringify(prices) !== JSON.stringify(account.rentalPrices)) {
            debouncedUpdate(prices);
        }
    }, [prices, debouncedUpdate, account.rentalPrices]);
    
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
        <div className="relative space-y-4">
           {isPending && (
             <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-background p-2 rounded-lg border shadow-sm">
                    <Spinner size="small" />
                    <span>Salvando...</span>
                </div>
            </div>
           )}
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
                                    disabled={isPending}
                                />
                                <div className="relative">
                                     <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                                    <Input
                                        placeholder="0,00"
                                        value={formatCurrencyForInput(displayValues[price.id] ?? '0')}
                                        onChange={e => handlePriceValueChange(price.id, e.target.value)}
                                        className="pl-8 text-right"
                                        required
                                        disabled={isPending}
                                    />
                                </div>
                        </div>
                            <Button type="button" variant="ghost" size="icon" onClick={() => removePrice(price.id)} aria-label="Remover Preço" disabled={isPending}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </div>
                    ))
                ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum preço cadastrado.</p>
                )}
                 <Button type="button" variant="outline" size="sm" className="w-full" onClick={addPrice} disabled={isPending}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Adicionar Novo Preço
                </Button>
            </div>
        </div>
    )
}
