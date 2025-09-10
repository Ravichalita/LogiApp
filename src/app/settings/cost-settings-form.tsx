
'use client';
import { useEffect, useTransition, useState, useRef } from 'react';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import type { Account, Base, TruckType, OperationalCost } from '@/lib/types';
import { updateOperationalCostsAction } from '@/lib/actions';
import { Save, PlusCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { nanoid } from 'nanoid';
import { cn } from '@/lib/utils';

const formatCurrencyForInput = (valueInCents: string): string => {
    if (!valueInCents || valueInCents === '0') return '0,00';
    const numericValue = parseInt(valueInCents.replace(/\D/g, ''), 10) || 0;
    const reais = Math.floor(numericValue / 100);
    const centavos = (numericValue % 100).toString().padStart(2, '0');
    return `${reais.toLocaleString('pt-BR')},${centavos}`;
};

export function CostSettingsForm({ account }: { account: Account }) {
    const { accountId } = useAuth();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const [costs, setCosts] = useState<OperationalCost[]>(account.operationalCosts || []);
    const [displayValues, setDisplayValues] = useState<Record<string, string>>(() => {
        const initialDisplayValues: Record<string, string> = {};
        (account.operationalCosts || []).forEach(c => {
            initialDisplayValues[c.id] = (c.value * 100).toFixed(0);
        });
        return initialDisplayValues;
    });

    const savedCosts = useRef(JSON.stringify(costs));

    const handleSave = () => {
        if (!accountId || isPending || JSON.stringify(costs) === savedCosts.current) {
            return;
        }

        startTransition(async () => {
            const validCosts = costs.filter(c => c.baseId && c.truckTypeId);
            const result = await updateOperationalCostsAction(accountId, validCosts);
            if (result.message === 'error') {
                toast({ title: 'Erro ao Salvar', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Salvo!', description: 'Custos operacionais atualizados.' });
                savedCosts.current = JSON.stringify(validCosts);
                if (document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                }
            }
        });
    };
    
    const handleCostChange = <K extends keyof OperationalCost>(id: string, field: K, value: OperationalCost[K]) => {
        setCosts(currentCosts =>
            currentCosts.map(c => (c.id === id ? { ...c, [field]: value } : c))
        );
    };
    
    const handleValueChange = (id: string, value: string) => {
        const cents = value.replace(/\D/g, '');
        setDisplayValues(prev => ({ ...prev, [id]: cents }));
        
        const numericValue = parseInt(cents, 10) || 0;
        handleCostChange(id, 'value', numericValue / 100);
    };

    const addCost = () => {
        const newId = nanoid(5);
        setCosts(prev => [...prev, { id: newId, baseId: '', truckTypeId: '', value: 0 }]);
        setDisplayValues(prev => ({...prev, [newId]: '0'}));
    };

    const removeCost = (id: string) => {
        const newCosts = costs.filter(c => c.id !== id);
        setCosts(newCosts);
        
        // Persist change on removal
        startTransition(async () => {
            if (!accountId) return;
            await updateOperationalCostsAction(accountId, newCosts);
            toast({ title: 'Custo Removido', description: 'A lista de custos foi atualizada.' });
            savedCosts.current = JSON.stringify(newCosts);
        });
    };
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSave();
        }
    };

    return (
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4">
             <div className={cn("max-h-[22rem] overflow-y-auto space-y-2 p-1 -m-1 relative", isPending && "opacity-50")}>
                {costs.length > 0 ? (
                    costs.map((cost) => (
                        <div key={cost.id} className="p-3 border rounded-lg bg-muted flex flex-col md:flex-row items-end gap-3">
                            <div className="w-full md:w-1/3 space-y-1">
                                <Label>Base de Partida</Label>
                                <Select value={cost.baseId} onValueChange={(val) => handleCostChange(cost.id, 'baseId', val)} onOpenChange={(open) => !open && handleSave()}>
                                    <SelectTrigger><SelectValue placeholder="Selecione a base" /></SelectTrigger>
                                    <SelectContent>
                                        {account.bases?.map(base => <SelectItem key={base.id} value={base.id}>{base.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="w-full md:w-1/3 space-y-1">
                                <Label>Tipo de Caminhão</Label>
                                 <Select value={cost.truckTypeId} onValueChange={(val) => handleCostChange(cost.id, 'truckTypeId', val)} onOpenChange={(open) => !open && handleSave()}>
                                    <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                                    <SelectContent>
                                        {account.truckTypes?.map(type => <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="w-full md:w-1/3 flex items-end gap-2">
                                <div className="space-y-1 flex-grow">
                                     <Label>Valor (R$ / Km)</Label>
                                      <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                                        <Input
                                            placeholder="0,00"
                                            value={formatCurrencyForInput(displayValues[cost.id] ?? '0')}
                                            onChange={(e) => handleValueChange(cost.id, e.target.value)}
                                            onBlur={handleSave}
                                            onKeyDown={handleKeyDown}
                                            disabled={isPending}
                                            className="pl-8 text-right"
                                            required
                                        />
                                    </div>
                                </div>
                                 <Button type="button" variant="ghost" size="icon" onClick={() => removeCost(cost.id)} aria-label="Remover Custo" disabled={isPending}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum custo operacional cadastrado.</p>
                )}
                 {isPending && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/30">
                        <Spinner />
                    </div>
                )}
            </div>
             <Button type="button" variant="outline" size="sm" className="w-full" onClick={addCost} disabled={isPending}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Adicionar Novo Custo Operacional
            </Button>
        </form>
    )
}
