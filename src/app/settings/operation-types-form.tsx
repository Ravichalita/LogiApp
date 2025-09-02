

'use client';
import { useState, useEffect, useTransition, useRef } from 'react';
import { updateOperationTypesAction } from '@/lib/actions';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import type { Account, OperationType } from '@/lib/types';
import { PlusCircle, Trash2 } from 'lucide-react';
import { nanoid } from 'nanoid';
import { cn } from '@/lib/utils';

const formatCurrencyForInput = (valueInCents: string): string => {
    if (!valueInCents) return '0,00';
    const numericValue = parseInt(valueInCents.replace(/\D/g, ''), 10) || 0;
    const reais = Math.floor(numericValue / 100);
    const centavos = (numericValue % 100).toString().padStart(2, '0');
    return `${reais.toLocaleString('pt-BR')},${centavos}`;
};

export function OperationTypesForm({ account }: { account: Account }) {
    const { accountId } = useAuth();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const [types, setTypes] = useState<OperationType[]>(account.operationTypes || []);
    
    const [displayValues, setDisplayValues] = useState<Record<string, string>>(() => {
        const initialDisplayValues: Record<string, string> = {};
        (account.operationTypes || []).forEach(p => {
            initialDisplayValues[p.id] = (p.value * 100).toFixed(0);
        });
        return initialDisplayValues;
    });

    const savedTypes = useRef(JSON.stringify(types));

    const handleSave = () => {
        // Only save if the data has actually changed
        if (!accountId || isPending || JSON.stringify(types) === savedTypes.current) {
            return;
        }

        startTransition(async () => {
            const result = await updateOperationTypesAction(accountId, types.filter(t => t.name.trim() !== ''));
             if (result.message === 'error') {
                 toast({
                    title: 'Erro ao Salvar',
                    description: 'Não foi possível salvar os tipos de operação. Verifique os dados e tente novamente.',
                    variant: 'destructive',
                });
            } else {
                 toast({
                    title: 'Salvo!',
                    description: 'Tipos de operação atualizados com sucesso.',
                });
                savedTypes.current = JSON.stringify(types);
                 if (document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                }
            }
        });
    };

    const handleNameChange = (id: string, name: string) => {
        setTypes(currentTypes =>
            currentTypes.map(t => (t.id === id ? { ...t, name } : t))
        );
    };

    const handleValueChange = (id: string, value: string) => {
        const cents = value.replace(/\D/g, '');
        setDisplayValues(prev => ({ ...prev, [id]: cents }));
        
        const numericValue = parseInt(cents, 10) || 0;
        setTypes(currentTypes =>
            currentTypes.map(t => (t.id === id ? { ...t, value: numericValue / 100 } : t))
        );
    };

    const addType = () => {
        const newId = nanoid(5);
        const newTypes = [...types, { id: newId, name: '', value: 0 }];
        setTypes(newTypes);
        setDisplayValues(prev => ({ ...prev, [newId]: '0' }));
    };
    
    const removeType = (id: string) => {
        const newTypes = types.filter(t => t.id !== id);
        setTypes(newTypes);
        const newDisplayValues = { ...displayValues };
        delete newDisplayValues[id];
        setDisplayValues(newDisplayValues);
        // Persist change on removal
        startTransition(async () => {
            if (!accountId) return;
            await updateOperationTypesAction(accountId, newTypes);
            toast({ title: 'Tipo Removido', description: 'A lista de tipos de operação foi atualizada.' });
            savedTypes.current = JSON.stringify(newTypes);
        });
    };
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSave();
        }
    }

    return (
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4">
            <div className={cn("max-h-[22rem] overflow-y-auto space-y-2 p-1 -m-1 relative", isPending && "opacity-50")}>
                {types.length > 0 ? (
                    types.map((type) => (
                        <div key={type.id} className="flex items-center gap-2 p-2 border rounded-md bg-muted">
                           <div className="grid grid-cols-2 gap-2 flex-grow">
                                <Input
                                    placeholder="Nome do Tipo (Ex: Entrega Especial)"
                                    value={type.name}
                                    onChange={e => handleNameChange(type.id, e.target.value)}
                                    onBlur={handleSave}
                                    onKeyDown={handleKeyDown}
                                    disabled={isPending}
                                    required
                                />
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                                    <Input
                                        placeholder="0,00"
                                        value={formatCurrencyForInput(displayValues[type.id] ?? '0')}
                                        onChange={e => handleValueChange(type.id, e.target.value)}
                                        onBlur={handleSave}
                                        onKeyDown={handleKeyDown}
                                        disabled={isPending}
                                        className="pl-8 text-right"
                                        required
                                    />
                                </div>
                            </div>
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeType(type.id)} aria-label="Remover Tipo" disabled={isPending}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </div>
                    ))
                ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum tipo de operação cadastrado.</p>
                )}
                 {isPending && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/30">
                        <Spinner />
                    </div>
                )}
            </div>
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={addType} disabled={isPending}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Adicionar Novo Tipo de Operação
            </Button>
        </form>
    )
}
