'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { updateClient } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { Client, Location } from '@/lib/types';
import { MapDialog } from '@/components/map-dialog';

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

export function EditClientForm({ client }: { client: Client }) {
  const [state, formAction] = useActionState(updateClient, initialState);
  const { toast } = useToast();
  
  const [address, setAddress] = useState(client.address);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(
    client.latitude && client.longitude ? { lat: client.latitude, lng: client.longitude } : null
  );

  useEffect(() => {
    if (state?.message === 'success') {
      toast({
        title: "Sucesso!",
        description: "Cliente atualizado.",
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
  
  const handleLocationSelect = (selectedLocation: Location) => {
    setLocation({ lat: selectedLocation.lat, lng: selectedLocation.lng });
    setAddress(selectedLocation.address);
  };


  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={client.id} />
      {location && <input type="hidden" name="latitude" value={location.lat} />}
      {location && <input type="hidden" name="longitude" value={location.lng} />}

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
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" defaultValue={client.email} />
        {state?.errors?.email && <p className="text-sm font-medium text-destructive">{state.errors.email[0]}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Endereço Principal</Label>
         <div className="flex gap-2">
            <Textarea id="address" name="address" value={address} onChange={(e) => setAddress(e.target.value)} required />
            <MapDialog onLocationSelect={handleLocationSelect} />
        </div>
        {location && (
          <p className="text-sm text-muted-foreground">
            Coordenadas: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
          </p>
        )}
        {state?.errors?.address && <p className="text-sm font-medium text-destructive">{state.errors.address[0]}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="observations">Observações</Label>
        <Textarea id="observations" name="observations" defaultValue={client.observations} />
        {state?.errors?.observations && <p className="text-sm font-medium text-destructive">{state.errors.observations[0]}</p>}
      </div>
      <SubmitButton />
    </form>
  );
}
