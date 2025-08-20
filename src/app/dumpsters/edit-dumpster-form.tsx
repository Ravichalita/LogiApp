'use client';

import { useState, useEffect, useTransition } from 'react';
import { updateDumpster } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { Dumpster } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { Spinner } from '@/components/ui/spinner';

const initialState = {
  errors: {},
  message: '',
};

function SubmitButton({ isPending }: { isPending: boolean }) {
  return (
    <Button type="submit" disabled={isPending} className="w-full">
      {isPending ? <Spinner size="small" /> : 'Salvar Alterações'}
    </Button>
  );
}

export function EditDumpsterForm({ dumpster, onSave }: { dumpster: Dumpster, onSave: () => void }) {
  const { user } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState(initialState);
  const { toast } = useToast();

  useEffect(() => {
    if (state?.message === 'success') {
      toast({
        title: "Sucesso!",
        description: "Caçamba atualizada.",
      });
      onSave();
    } else if (state?.message === 'error' && state.error) {
      toast({
        title: "Erro",
        description: state.error,
        variant: "destructive",
      });
    }
  }, [state, toast, onSave]);

  const handleFormAction = (formData: FormData) => {
    startTransition(async () => {
      if (!user) return;
      const boundAction = updateDumpster.bind(null, user.uid, state);
      const result = await boundAction(formData);
      setState(result);
    });
  };

  return (
    <form action={handleFormAction} className="space-y-4">
      <input type="hidden" name="id" value={dumpster.id} />
      <div className="space-y-2">
        <Label htmlFor="name">Nome/Identificador</Label>
        <Input id="name" name="name" defaultValue={dumpster.name} required />
        {state?.errors?.name && <p className="text-sm font-medium text-destructive">{state.errors.name[0]}</p>}
      </div>
       <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="color">Cor</Label>
          <Input id="color" name="color" defaultValue={dumpster.color} required />
          {state?.errors?.color && <p className="text-sm font-medium text-destructive">{state.errors.color[0]}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="size">Tamanho (m³)</Label>
          <Input id="size" name="size" type="number" defaultValue={dumpster.size} required />
          {state?.errors?.size && <p className="text-sm font-medium text-destructive">{state.errors.size[0]}</p>}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <Select name="status" defaultValue={dumpster.status} required>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Disponível">Disponível</SelectItem>
            <SelectItem value="Alugada">Alugada</SelectItem>
            <SelectItem value="Em Manutenção">Em Manutenção</SelectItem>
          </SelectContent>
        </Select>
         {state?.errors?.status && <p className="text-sm font-medium text-destructive">{state.errors.status[0]}</p>}
      </div>
      <SubmitButton isPending={isPending} />
    </form>
  );
}
