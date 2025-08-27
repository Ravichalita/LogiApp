
'use client';

import { useEffect, useState, useTransition } from 'react';
import { createClient } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { Location } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { Spinner } from '@/components/ui/spinner';
import { DialogClose, DialogFooter } from '@/components/ui/dialog';
import { AddressInput } from '@/components/address-input';

const initialState = {
  errors: {},
  message: '',
};

function SubmitButton({ isPending, formId }: { isPending: boolean, formId: string }) {
  return (
    <Button type="submit" form={formId} disabled={isPending}>
      {isPending ? <Spinner size="small" /> : 'Salvar Cliente'}
    </Button>
  );
}

export function ClientForm({ onSave }: { onSave?: () => void }) {
  const { accountId } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<any>(initialState);
  const formId = "client-form";
  const { toast } = useToast();
  
  // Control all fields with state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [observations, setObservations] = useState('');
  const [location, setLocation] = useState<Omit<Location, 'address'> | null>(null);

  const resetFormState = () => {
      setName('');
      setPhone('');
      setCpfCnpj('');
      setEmail('');
      setAddress('');
      setObservations('');
      setLocation(null);
      setState(initialState);
  };
  
  useEffect(() => {
    if (state?.message === 'success') {
      toast({
        title: "Sucesso!",
        description: "Novo cliente cadastrado.",
      });
      resetFormState();
      onSave?.();
    } else if (state?.message === 'error' && state.error) {
      toast({
        title: "Erro",
        description: state.error,
        variant: "destructive",
      });
       setState(prevState => ({...prevState, message: '', error: undefined }));
    } else if (state?.errors) {
       // Optionally handle field-specific errors
    }
  }, [state, toast, onSave]);
  
  const handleLocationSelect = (selectedLocation: Location) => {
    setLocation({ lat: selectedLocation.lat, lng: selectedLocation.lng });
    setAddress(selectedLocation.address);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      if (!accountId) {
        toast({ title: 'Erro', description: 'Conta não identificada.', variant: 'destructive' });
        return;
      }
      const boundAction = createClient.bind(null, accountId);
      const result = await boundAction(state, formData);
      setState(result);
    });
  };

  if (!accountId) {
    return <div className="flex justify-center items-center"><Spinner /></div>;
  }

  return (
    <div className="flex flex-col h-full">
      <form id={formId} onSubmit={handleSubmit} className="space-y-4 overflow-y-auto px-6 pb-4 flex-grow">
        <input type="hidden" name="address" value={address} />
        {location && <input type="hidden" name="latitude" value={location.lat} />}
        {location && <input type="hidden" name="longitude" value={location.lng} />}
        
        <div className="space-y-2">
          <Label htmlFor="name">Nome do Cliente</Label>
          <Input id="name" name="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="João da Silva Construções" required />
          {state?.errors?.name && <p className="text-sm font-medium text-destructive">{state.errors.name[0]}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Telefone</Label>
          <Input id="phone" name="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 98765-4321" required />
          {state?.errors?.phone && <p className="text-sm font-medium text-destructive">{state.errors.phone[0]}</p>}
        </div>
         <div className="space-y-2">
          <Label htmlFor="cpfCnpj">CPF/CNPJ (Opcional)</Label>
          <Input id="cpfCnpj" name="cpfCnpj" value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
          {state?.errors?.cpfCnpj && <p className="text-sm font-medium text-destructive">{state.errors.cpfCnpj[0]}</p>}
        </div>
         <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contato@joao.com" />
          {state?.errors?.email && <p className="text-sm font-medium text-destructive">{state.errors.email[0]}</p>}
        </div>
        <div className="space-y-2">
            <Label htmlFor="address-input">Endereço Principal</Label>
            <AddressInput
                id="address-input"
                initialValue={address}
                onLocationSelect={handleLocationSelect}
            />
            {state?.errors?.address && <p className="text-sm font-medium text-destructive">{state.errors.address[0]}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="observations">Observações</Label>
          <Textarea id="observations" name="observations" value={observations} onChange={(e) => setObservations(e.target.value)} placeholder="Ex: Deixar caçamba na calçada, portão azul." />
          {state?.errors?.observations && <p className="text-sm font-medium text-destructive">{state.errors.observations[0]}</p>}
        </div>
      </form>
       <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" onClick={resetFormState}>Cancelar</Button>
            </DialogClose>
            <SubmitButton isPending={isPending} formId={formId} />
        </DialogFooter>
      </div>
  );
}
