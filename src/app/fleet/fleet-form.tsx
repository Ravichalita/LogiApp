
'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { createTruckAction, updateTruckAction } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { Spinner } from '@/components/ui/spinner';
import { DialogClose, DialogFooter } from '@/components/ui/dialog';
import type { Truck } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const initialState = {
  errors: {},
  message: '',
};

const truckTypes = [
    'caminhão vácuo',
    'caminhão hidro vácuo',
    'poliguindaste'
];

function SubmitButton({ isPending, isEdit }: { isPending: boolean, isEdit?: boolean }) {
  return (
    <Button type="submit" disabled={isPending}>
      {isPending ? <Spinner size="small" /> : isEdit ? 'Salvar Alterações' : 'Salvar Caminhão'}
    </Button>
  );
}

interface FleetFormProps {
    truck?: Truck;
    onSave?: () => void;
}

export function FleetForm({ truck, onSave }: FleetFormProps) {
  const { accountId } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<any>(initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();
  const isEdit = !!truck;

  useEffect(() => {
    if (state?.message === 'success') {
      toast({ title: 'Sucesso', description: `Caminhão ${isEdit ? 'atualizado' : 'cadastrado'}.` });
      if (!isEdit) formRef.current?.reset();
      setState(initialState);
      onSave?.();
    } else if (state?.message === 'error' && state.error) {
      toast({ title: 'Erro', description: state.error, variant: 'destructive' });
      setState(prevState => ({...prevState, message: '', error: undefined }));
    }
  }, [state, toast, onSave, isEdit]);

  const action = (formData: FormData) => {
    startTransition(async () => {
      if (!accountId) {
        toast({ title: 'Erro', description: 'Conta não identificada.', variant: 'destructive' });
        return;
      }
      
      const boundAction = isEdit
        ? updateTruckAction.bind(null, accountId)
        : createTruckAction.bind(null, accountId);
        
      const result = await boundAction(state, formData);
      setState(result);
    });
  };

  return (
    <form ref={formRef} action={action} className="space-y-4">
      {isEdit && <input type="hidden" name="id" value={truck.id} />}
      <div className="space-y-2">
        <Label htmlFor="name">Nome/Identificador</Label>
        <Input id="name" name="name" placeholder="Ex: Caminhão 01" defaultValue={truck?.name} required />
        {state?.errors?.name && <p className="text-sm font-medium text-destructive">{state.errors.name[0]}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="plate">Placa</Label>
        <Input id="plate" name="plate" placeholder="ABC1D23" defaultValue={truck?.plate} required />
        {state?.errors?.plate && <p className="text-sm font-medium text-destructive">{state.errors.plate[0]}</p>}
      </div>
       <div className="space-y-2">
        <Label htmlFor="type">Tipo de Caminhão</Label>
        <Select name="type" defaultValue={truck?.type}>
            <SelectTrigger>
                <SelectValue placeholder="Selecione um tipo" />
            </SelectTrigger>
            <SelectContent>
                {truckTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
            </SelectContent>
        </Select>
        {state?.errors?.type && <p className="text-sm font-medium text-destructive">{state.errors.type[0]}</p>}
      </div>
       <div className="space-y-2">
        <Label htmlFor="model">Modelo</Label>
        <Input id="model" name="model" placeholder="Mercedes-Benz Atego" defaultValue={truck?.model} />
      </div>
       <div className="space-y-2">
        <Label htmlFor="year">Ano</Label>
        <Input id="year" name="year" type="number" placeholder="2022" defaultValue={truck?.year} />
      </div>
      {isEdit && (
         <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select name="status" defaultValue={truck.status}>
                <SelectTrigger>
                    <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="Disponível">Disponível</SelectItem>
                    <SelectItem value="Em Manutenção">Em Manutenção</SelectItem>
                    <SelectItem value="Em Operação">Em Operação</SelectItem>
                </SelectContent>
            </Select>
        </div>
      )}
      <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Cancelar</Button>
          </DialogClose>
          <SubmitButton isPending={isPending} isEdit={isEdit} />
      </DialogFooter>
    </form>
  );
}
