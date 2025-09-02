
'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { Location, Account } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { Spinner } from '@/components/ui/spinner';
import { AddressInput } from '@/components/address-input';
import { updateBaseAddressAction } from '@/lib/actions';

export function BaseAddressForm({ account }: { account: Account }) {
  const { accountId } = useAuth();
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  
  const [address, setAddress] = useState(account.baseAddress || '');
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(
    account.baseLatitude && account.baseLongitude ? { lat: account.baseLatitude, lng: account.baseLongitude } : null
  );

  const initialAddress = useRef(account.baseAddress || '');

  const handleSave = () => {
    // Only save if the address has actually changed
    if (!accountId || isPending || address === initialAddress.current) {
        return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set('baseAddress', address);
      if (location) {
        formData.set('baseLatitude', String(location.lat));
        formData.set('baseLongitude', String(location.lng));
      } else {
        formData.delete('baseLatitude');
        formData.delete('baseLongitude');
      }

      const result = await updateBaseAddressAction(accountId, null, formData);

      if (result?.errors) {
         toast({
            title: "Erro de Validação",
            description: Object.values(result.errors).flat().join(' '),
            variant: "destructive"
         });
      } else if (result?.message === 'error') {
          toast({
            title: "Erro ao Salvar",
            description: result.error,
            variant: "destructive",
          });
      } else {
         toast({
            title: "Salvo!",
            description: "Endereço da base atualizado.",
        });
        initialAddress.current = address;
      }
    });
  }

  const handleLocationSelect = (selectedLocation: Location) => {
    setLocation({ lat: selectedLocation.lat, lng: selectedLocation.lng });
    setAddress(selectedLocation.address);
    // Trigger save immediately after selection
    startTransition(async () => {
        if (!accountId) return;
         const formData = new FormData();
        formData.set('baseAddress', selectedLocation.address);
        formData.set('baseLatitude', String(selectedLocation.lat));
        formData.set('baseLongitude', String(selectedLocation.lng));
        const result = await updateBaseAddressAction(accountId, null, formData);
        if (result?.message === 'success') {
            toast({ title: 'Salvo!', description: 'Endereço da base atualizado.' });
            initialAddress.current = selectedLocation.address;
        } else {
             toast({ title: 'Erro', description: result.error, variant: 'destructive' });
        }
    });
  };
  
  const handleAddressChange = (newAddress: string) => {
    setAddress(newAddress);
    setLocation(null); // Clear location when address is manually changed
  }
  
  const handleBlur = () => {
    handleSave();
  }

  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-2">
        <div className="flex items-center gap-2">
            <AddressInput
                id="address-input"
                value={address}
                onLocationSelect={handleLocationSelect}
                onInputChange={handleAddressChange}
                onBlur={handleBlur}
            />
            {isPending && <Spinner size="small" />}
        </div>
    </form>
  );
}
