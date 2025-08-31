
'use client';
import { useState, useEffect, useTransition } from 'react';
import { updateServicesAction } from '@/lib/actions';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import type { Account, Service } from '@/lib/types';
import { PlusCircle, Trash2 } from 'lucide-react';
import { nanoid } from 'nanoid';

export function ServicesForm({ account }: { account: Account }) {
    const { accountId } = useAuth();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const [services, setServices] = useState<Service[]>(account.services || []);
    
    const handleFormSubmit = (event?: React.FormEvent<HTMLFormElement>) => {
        event?.preventDefault();
        if (!accountId || isPending) return;

        startTransition(async () => {
            const result = await updateServicesAction(accountId, services);
             if (result.message === 'error') {
                 toast({
                    title: 'Erro ao Salvar',
                    description: 'Não foi possível salvar os serviços. Verifique os dados e tente novamente.',
                    variant: 'destructive',
                });
            } else {
                 toast({
                    title: 'Salvo!',
                    description: 'Tabela de serviços atualizada com sucesso.',
                });
                 if (document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                }
            }
        });
    };
    
    const handleNameChange = (id: string, name: string) => {
        setServices(currentServices =>
            currentServices.map(s => (s.id === id ? { ...s, name } : s))
        );
    }

    const addService = () => {
        const newId = nanoid(5);
        setServices(currentServices => [...currentServices, { id: newId, name: '' }]);
    }
    
    const removeService = (id: string) => {
        const updatedServices = services.filter(s => s.id !== id);
        setServices(updatedServices);
        // Trigger save immediately on removal
        startTransition(async () => {
            if (!accountId) return;
            await updateServicesAction(accountId, updatedServices);
            toast({ title: 'Serviço Removido', description: 'A tabela de serviços foi atualizada.' });
        });
    }

    return (
        <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="max-h-[22rem] overflow-y-auto space-y-2 p-1 -m-1">
                {services.length > 0 ? (
                    services.map((service) => (
                        <div key={service.id} className="flex items-center gap-2 p-2 border rounded-md bg-muted">
                            <Input
                                placeholder="Nome do Serviço"
                                value={service.name}
                                onChange={e => handleNameChange(service.id, e.target.value)}
                                required
                            />
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeService(service.id)} aria-label="Remover Serviço">
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </div>
                    ))
                ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum serviço cadastrado.</p>
                )}
            </div>
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={addService}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Adicionar Novo Serviço
            </Button>
            <button type="submit" className="hidden" aria-hidden="true">Salvar</button>
        </form>
    )
}
