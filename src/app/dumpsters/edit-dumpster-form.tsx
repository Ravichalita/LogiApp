'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { updateDumpster } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { Dumpster } from '@/lib/types';

const initialState = {
  errors: {},
  message: '',
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? 'Salvando...' : 'Salvar Alterações'}
    </Button>
  );
}

export function EditDumpsterForm({ dumpster }: { dumpster: Dumpster }) {
  const [state, formAction] = useActionState(updateDumpster, initialState);
  const { toast } = useToast();

  useEffect(() => {
    if (state?.message === 'success') {
      toast({
        title: "Sucesso!",
        description: "Caçamba atualizada.",
      });
      // Here you might want to close the dialog
    } else if (state?.message === 'error' && state.error) {
      toast({
        title: "Erro",
        description: state.error,
        variant: "destructive",
      });
    }
  }, [state, toast]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={dumpster.id} />
      <div className="space-y-2">
        <Label htmlFor="name">Nome/Identificador</Label>
        <Input id="name" name="name" defaultValue={dumpster.name} required />
        {state?.errors?.name && <p className="text-sm font-medium text-destructive">{state.errors.name[0]}</p>}
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
      <SubmitButton />
    </form>
  );
}