
'use client';

import { useEffect, useState, useTransition } from 'react';
import { updateClient } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { Client, Location } from '@/lib/types';
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
      {isPending ? <Spinner size="small" /> : 'Salvar Alterações'}
    </Button>
  );
}

export function EditClientForm({ client, onSave }: { client: Client, onSave: () => void }) {
  const { accountId } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<any>(initialState);
  const { toast } = useToast();
  const formId = `edit-client-form-${client.id}`;
  
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
      onSave();
    } else if (state?.message === 'error' && state.error) {
      toast({
        title: "Erro",
        description: state.error,
        variant: "destructive",
      });
    }
  }, [state, toast, onSave]);
  
  const handleLocationSelect = (selectedLocation: Location) => {
    setLocation({ lat: selectedLocation.lat, lng: selectedLocation.lng });
    setAddress(selectedLocation.address);
  };

  const handleFormAction = (formData: FormData) => {
    startTransition(async () => {
      if (!accountId) return;
      formData.set('address', address); // Make sure the address from state is in formData
      const boundAction = updateClient.bind(null, accountId);
      const result = await boundAction(state, formData);
      setState(result);
    });
  };

  return (
    <>
      <form id={formId} action={handleFormAction} className="space-y-4 overflow-y-auto p-6 pt-2 pb-4 flex-grow">
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
                initialValue={address}
                onLocationSelect={handleLocationSelect}
            />
            {state?.errors?.address && <p className="text-sm font-medium text-destructive">{state.errors.address[0]}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="observations">Observações</Label>
          <Textarea id="observations" name="observations" defaultValue={client.observations ?? ''} />
          {state?.errors?.observations && <p className="text-sm font-medium text-destructive">{state.errors.observations[0]}</p>}
        </div>
      </form>
      <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <SubmitButton isPending={isPending} formId={formId} />
          </DialogFooter>
    </>
  );
}
