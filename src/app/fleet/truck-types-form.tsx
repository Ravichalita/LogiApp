

'use client';
import { useState, useTransition } from 'react';
import { updateTruckTypesAction } from '@/lib/actions';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import type { TruckType } from '@/lib/types';
import { Plus, Trash2 } from 'lucide-react';
import { nanoid } from 'nanoid';
import { DialogFooter, DialogClose } from '@/components/ui/dialog';

interface TruckTypesFormProps {
    currentTypes: TruckType[];
    onSave: () => void;
}

export function TruckTypesForm({ currentTypes, onSave }: TruckTypesFormProps) {
    const { accountId } = useAuth();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const [types, setTypes] = useState<TruckType[]>(currentTypes);

    const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!accountId || isPending) return;

        startTransition(async () => {
            // Filter out any empty names before saving
            const typesToSave = types.filter(t => t.name.trim() !== '');
            const result = await updateTruckTypesAction(accountId, typesToSave);
             if (result.message === 'error') {
                 toast({
                    title: 'Erro ao Salvar',
                    description: 'Não foi possível salvar os tipos. Tente novamente.',
                    variant: 'destructive',
                });
            } else {
                 toast({
                    title: 'Salvo!',
                    description: 'A lista de tipos de caminhão foi atualizada.',
                });
                onSave();
            }
        });
    };

    const handleNameChange = (id: string, name: string) => {
        setTypes(currentTypes =>
            currentTypes.map(t =>
                t.id === id ? { ...t, name: name } : t
            )
        )
    }

    const addType = () => {
        setTypes(currentTypes => [...currentTypes, { id: nanoid(5), name: '' }]);
    }
    
    const removeType = (id: string) => {
        setTypes(currentTypes => currentTypes.filter(t => t.id !== id));
    }

    return (
        <form onSubmit={handleFormSubmit} className="space-y-4 pt-4">
            <div className="max-h-[22rem] overflow-y-auto space-y-2 p-1 -m-1">
                {types.map((type, index) => (
                    <div key={type.id} className="flex items-center gap-2">
                        <Input
                            placeholder={`Tipo ${index + 1}`}
                            value={type.name}
                            onChange={e => handleNameChange(type.id, e.target.value)}
                            required
                        />
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeType(type.id)} aria-label="Remover Tipo">
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    </div>
                ))}
            </div>
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={addType}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Novo Tipo
            </Button>
            <DialogFooter>
                 <DialogClose asChild>
                    <Button type="button" variant="outline">Cancelar</Button>
                 </DialogClose>
                <Button type="submit" disabled={isPending}>
                    {isPending ? <Spinner size="small" /> : 'Salvar Tipos'}
                </Button>
            </DialogFooter>
        </form>
    )
}
