

'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { createTruckAction, updateTruckAction } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { Spinner } from '@/components/ui/spinner';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Truck, TruckType } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { TruckTypesForm } from './truck-types-form';
import { getAccount } from '@/lib/data';

const initialState = {
  errors: {},
  message: '',
};

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

  const [truckTypes, setTruckTypes] = useState<TruckType[]>([]);
  const [showManageTypes, setShowManageTypes] = useState(false);

  useEffect(() => {
    if (accountId) {
      const unsub = getAccount(accountId, (account) => {
        if (account?.truckTypes) {
          setTruckTypes(account.truckTypes);
        }
      });
      return () => unsub();
    }
  }, [accountId]);


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
      
      const rawData = Object.fromEntries(formData.entries());
      
      if (rawData.year === '') delete rawData.year;
      
      const cleanFormData = new FormData();
      Object.entries(rawData).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
              cleanFormData.set(key, value as string);
          }
      });
      
      const boundAction = isEdit
        ? updateTruckAction.bind(null, accountId)
        : createTruckAction.bind(null, accountId);
        
      const result = await boundAction(state, cleanFormData);
      setState(result);
    });
  };
  
  const handleTypeChange = (value: string) => {
    if (value === 'manage') {
      setShowManageTypes(true);
    }
  }

  return (
    <>
    <div className="p-6">
        <form ref={formRef} action={action} className="space-y-4">
        {isEdit && <input type="hidden" name="id" value={truck.id} />}
        <div className="space-y-2">
            <Label htmlFor="name">Modelo / Nome</Label>
            <Input id="name" name="name" placeholder="Ex: Mercedes-Benz Atego" defaultValue={truck?.name} required />
            {state?.errors?.name && <p className="text-sm font-medium text-destructive">{state.errors.name[0]}</p>}
        </div>
        <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label htmlFor="plate">Placa</Label>
                <Input id="plate" name="plate" placeholder="ABC1D23" defaultValue={truck?.plate} required />
                {state?.errors?.plate && <p className="text-sm font-medium text-destructive">{state.errors.plate[0]}</p>}
            </div>
             <div className="space-y-2">
                <Label htmlFor="year">Ano</Label>
                <Input id="year" name="year" type="number" placeholder="2022" defaultValue={truck?.year ?? ''} />
            </div>
        </div>
        <div className="space-y-2">
            <Label htmlFor="type">Tipo de Caminhão</Label>
            <Select name="type" defaultValue={truck?.type} onValueChange={handleTypeChange}>
                <SelectTrigger>
                    <SelectValue placeholder="Selecione um tipo" />
                </SelectTrigger>
                <SelectContent>
                    {truckTypes.map(type => (
                        <SelectItem key={type.id} value={type.name}>{type.name}</SelectItem>
                    ))}
                    <Separator />
                     <SelectItem value="manage">
                        <span className="text-primary font-medium">Gerenciar Tipos...</span>
                    </SelectItem>
                </SelectContent>
            </Select>
            {state?.errors?.type && <p className="text-sm font-medium text-destructive">{state.errors.type[0]}</p>}
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
    </div>
    <Dialog open={showManageTypes} onOpenChange={setShowManageTypes}>
        <DialogContent>
             <DialogHeader>
                <DialogTitle>Gerenciar Tipos de Caminhão</DialogTitle>
                <DialogDescription>
                    Adicione, edite ou remova os tipos de caminhão disponíveis para seleção.
                </DialogDescription>
            </DialogHeader>
            <TruckTypesForm 
                currentTypes={truckTypes} 
                onSave={() => setShowManageTypes(false)}
            />
        </DialogContent>
    </Dialog>
    </>
  );
}
