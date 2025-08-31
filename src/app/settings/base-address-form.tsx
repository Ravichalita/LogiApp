
'use client';

import { useState, useTransition } from 'react';
import { updateBaseAddressAction } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { Account, Location } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { Spinner } from '@/components/ui/spinner';
import { AddressInput } from '@/components/address-input';

export function BaseAddressForm({ account }: { account: Account }) {
  const { accountId } = useAuth();
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  
  const [address, setAddress] = useState(account.baseAddress || '');
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(account.baseLocation || null);

  const handleLocationSelect = (selectedLocation: Location) => {
    setLocation({ lat: selectedLocation.lat, lng: selectedLocation.lng });
    setAddress(selectedLocation.address);
  };
  
  const handleAddressChange = (newAddress: string) => {
    setAddress(newAddress);
  }

  const handleFormAction = (formData: FormData) => {
    startTransition(async () => {
      if (!accountId) return;
      if (!location) {
          toast({ title: "Erro", description: "Por favor, selecione um endereço válido no mapa.", variant: "destructive" });
          return;
      }

      formData.set('baseAddress', address);
      formData.set('baseLatitude', String(location.lat));
      formData.set('baseLongitude', String(location.lng));
      
      const boundAction = updateBaseAddressAction.bind(null, accountId);
      const result = await boundAction(null, formData);

      if (result?.message === 'error') {
          toast({
            title: "Erro ao Salvar",
            description: result.error,
            variant: "destructive",
          });
      } else {
         toast({
            title: "Sucesso!",
            description: "Endereço da base atualizado.",
        });
      }
    });
  };

  return (
    <form action={handleFormAction} className="space-y-4">
        <AddressInput
            id="base-address-input"
            initialValue={address}
            onLocationSelect={handleLocationSelect}
            onInputChange={handleAddressChange}
            initialLocation={location}
        />
        <Button type="submit" disabled={isPending}>
            {isPending ? <Spinner size="small" /> : 'Salvar Endereço da Base'}
        </Button>
    </form>
  );
}
