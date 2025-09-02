
'use client';

import { useState, useTransition } from 'react';
import { updateClient } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { Client, Location } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { Spinner } from '@/components/ui/spinner';
import { AddressInput } from '@/components/address-input';
import Link from 'next/link';

const initialState = {
  errors: {},
  message: '',
};

function SubmitButton({ isPending }: { isPending: boolean }) {
  return (
    <Button type="submit" disabled={isPending} size="lg">
      {isPending ? <Spinner size="small" /> : 'Salvar Alterações'}
    </Button>
  );
}

export function EditClientForm({ client }: { client: Client }) {
  const { accountId } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<any>(initialState);
  const { toast } = useToast();
  
  const [address, setAddress] = useState(client.address);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(
    client.latitude && client.longitude ? { lat: client.latitude, lng: client.longitude } : null
  );

  const handleLocationSelect = (selectedLocation: Location) => {
    setLocation({ lat: selectedLocation.lat, lng: selectedLocation.lng });
    setAddress(selectedLocation.address);
  };
  
  const handleAddressChange = (newAddress: string) => {
    setAddress(newAddress);
    // When address changes manually, we lose the specific lat/lng
    setLocation(null);
  }

  const handleFormAction = (formData: FormData) => {
    startTransition(async () => {
      if (!accountId) return;

      formData.set('address', address);
      if (location) {
        formData.set('latitude', String(location.lat));
        formData.set('longitude', String(location.lng));
      } else {
        formData.set('latitude', '');
        formData.set('longitude', '');
      }

      const boundAction = updateClient.bind(null, accountId);
      const result = await boundAction(state, formData);

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
      } else {
         toast({
            title: "Sucesso!",
            description: "Cliente atualizado.",
        });
      }
    });
  };

  return (
    <>
      <form action={handleFormAction} className="space-y-4">
        <input type="hidden" name="id" value={client.id} />
        
        <div className="space-y-2">
          <Label htmlFor="name">Nome do Cliente</Label>
          <Input id="name" name="name" defaultValue={client.name} required />
          {state?.errors?.name && <p className="text-sm font-medium text-destructive">{state.errors.name[0]}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Telefone</Label>
          <Input id="phone" name="phone" defaultValue={client.phone} required />
          {state?.errors?.phone && <p className="text-sm font-medium text-destructive">{state.errors.phone[0]}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="cpfCnpj">CPF/CNPJ (Opcional)</Label>
          <Input id="cpfCnpj" name="cpfCnpj" defaultValue={client.cpfCnpj ?? ''} />
          {state?.errors?.cpfCnpj && <p className="text-sm font-medium text-destructive">{state.errors.cpfCnpj[0]}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" defaultValue={client.email ?? ''} />
          {state?.errors?.email && <p className="text-sm font-medium text-destructive">{state.errors.email[0]}</p>}
        </div>
        <div className="space-y-2">
            <Label htmlFor="address-input">Endereço Principal</Label>
            <AddressInput
                id="address-input"
                value={address}
                onLocationSelect={handleLocationSelect}
                onInputChange={handleAddressChange}
                initialLocation={location}
            />
            {state?.errors?.address && <p className="text-sm font-medium text-destructive">{state.errors.address[0]}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="observations">Observações</Label>
          <Textarea id="observations" name="observations" defaultValue={client.observations ?? ''} />
          {state?.errors?.observations && <p className="text-sm font-medium text-destructive">{state.errors.observations[0]}</p>}
        </div>
        <div className="flex flex-col sm:flex-row-reverse gap-2 pt-4">
            <SubmitButton isPending={isPending} />
            <Button asChild variant="outline" size="lg">
                <Link href="/clients">Cancelar</Link>
            </Button>
        </div>
      </form>
    </>
  );
}
