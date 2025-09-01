
'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { createTruckAction } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { Spinner } from '@/components/ui/spinner';
import { DialogClose, DialogFooter } from '@/components/ui/dialog';
import type { Truck } from '@/lib/types';


const initialState = {
  errors: {},
  message: '',
};

function SubmitButton({ isPending }: { isPending: boolean }) {
  return (
    <Button type="submit" disabled={isPending}>
      {isPending ? <Spinner size="small" /> : 'Salvar Caminhão'}
    </Button>
  );
}

export function TruckForm({ onSave }: { onSave?: () => void }) {
  const { accountId } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<any>(initialState);
  const [status, setStatus] = useState<Truck['status']>('Disponível');
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (state?.message === 'success') {
      toast({ title: 'Sucesso', description: 'Caminhão cadastrado.' });
      formRef.current?.reset();
      setStatus('Disponível');
      setState(initialState);
      onSave?.();
    } else if (state?.message === 'error' && state.error) {
      toast({ title: 'Erro', description: state.error, variant: 'destructive' });
      setState(prevState => ({...prevState, message: '', error: undefined }));
    }
  }, [state, toast, onSave]);

  const action = (formData: FormData) => {
    startTransition(async () => {
      if (!accountId) {
        toast({ title: 'Erro', description: 'Conta não identificada.', variant: 'destructive' });
        return;
      }
      const boundAction = createTruckAction.bind(null, accountId);
      const result = await boundAction(state, formData);
      setState(result);
    });
  };

  if (!accountId) {
    return <div className="flex justify-center items-center"><Spinner /></div>;
  }

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="model">Modelo/Identificador</Label>
        <Input id="model" name="model" placeholder="Ex: Scania R450" required />
        {state?.errors?.model && <p className="text-sm font-medium text-destructive">{state.errors.model[0]}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="licensePlate">Placa</Label>
        <Input id="licensePlate" name="licensePlate" placeholder="Ex: BRA2E19" required />
        {state?.errors?.licensePlate && <p className="text-sm font-medium text-destructive">{state.errors.licensePlate[0]}</p>}
      </div>
      <div className="space-y-2">
          <Label htmlFor="year">Ano</Label>
          <Input id="year" name="year" type="number" placeholder="Ex: 2023" required />
          {state?.errors?.year && <p className="text-sm font-medium text-destructive">{state.errors.year[0]}</p>}
      </div>
      <div className="space-y-2">
        <Label>Status Inicial</Label>
        <Select name="status" value={status} onValueChange={(value) => setStatus(value as Truck['status'])}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Disponível">Disponível</SelectItem>
            <SelectItem value="Em Manutenção">Em Manutenção</SelectItem>
          </SelectContent>
        </Select>
         {state?.errors?.status && <p className="text-sm font-medium text-destructive">{state.errors.status[0]}</p>}
      </div>
      <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Cancelar</Button>
          </DialogClose>
          <SubmitButton isPending={isPending} />
        </DialogFooter>
    </form>
  );
}
