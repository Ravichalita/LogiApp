
'use client';

import { useTransition, useState } from 'react';
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

function SubmitButton({ isPending }: { isPending: boolean }) {
  return (
    <Button type="submit" disabled={isPending}>
      {isPending ? <Spinner size="small" /> : 'Salvar Cliente'}
    </Button>
  );
}

export function ClientForm() {
  const { accountId } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<any>(initialState);
  const { toast } = useToast();
  
  const [address, setAddress] = useState('');
  const [location, setLocation] = useState<Omit<Location, 'address'> | null>(null);
  
  const handleLocationSelect = (selectedLocation: Location) => {
    setLocation({ lat: selectedLocation.lat, lng: selectedLocation.lng });
    setAddress(selectedLocation.address);
  };

  const handleAddressChange = (newAddress: string) => {
    setAddress(newAddress);
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    
    // Ensure the latest address from state is included
    formData.set('address', address);
    if(location) {
      formData.set('latitude', String(location.lat));
      formData.set('longitude', String(location.lng));
    }

    startTransition(async () => {
      if (!accountId) {
        toast({ title: 'Erro', description: 'Conta não identificada.', variant: 'destructive' });
        return;
      }
      const boundAction = createClient.bind(null, accountId);
      const result = await boundAction(initialState, formData);
      
      if (result.errors) {
         toast({
            title: "Erro de Validação",
            description: Object.values(result.errors).flat().join(' '),
            variant: "destructive"
         });
         setState(result);
      } else if (result.message === 'error') {
          toast({
            title: "Erro ao Salvar",
            description: result.error,
            variant: "destructive",
          });
          setState(result);
      }
    });
  };

  if (!accountId) {
    return <div className="flex justify-center items-center"><Spinner /></div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nome do Cliente</Label>
        <Input id="name" name="name" placeholder="João da Silva Construções" required />
        {state?.errors?.name && <p className="text-sm font-medium text-destructive">{state.errors.name[0]}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Telefone</Label>
        <Input id="phone" name="phone" placeholder="(11) 98765-4321" required />
        {state?.errors?.phone && <p className="text-sm font-medium text-destructive">{state.errors.phone[0]}</p>}
      </div>
       <div className="space-y-2">
        <Label htmlFor="cpfCnpj">CPF/CNPJ (Opcional)</Label>
        <Input id="cpfCnpj" name="cpfCnpj" placeholder="00.000.000/0000-00" />
        {state?.errors?.cpfCnpj && <p className="text-sm font-medium text-destructive">{state.errors.cpfCnpj[0]}</p>}
      </div>
       <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" placeholder="contato@joao.com" />
        {state?.errors?.email && <p className="text-sm font-medium text-destructive">{state.errors.email[0]}</p>}
      </div>
      <div className="space-y-2">
          <Label htmlFor="address-input">Endereço Principal</Label>
          <AddressInput
              id="address-input"
              initialValue={address}
              onLocationSelect={handleLocationSelect}
              onInputChange={handleAddressChange}
          />
          {state?.errors?.address && <p className="text-sm font-medium text-destructive">{state.errors.address[0]}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="observations">Observações</Label>
        <Textarea id="observations" name="observations" placeholder="Ex: Deixar caçamba na calçada, portão azul." />
        {state?.errors?.observations && <p className="text-sm font-medium text-destructive">{state.errors.observations[0]}</p>}
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
