
'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { createClient } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { MapDialog } from '@/components/map-dialog';
import type { Location } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { Spinner } from '@/components/ui/spinner';
import { DialogClose, DialogFooter } from '@/components/ui/dialog';

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

export function ClientForm({ onSave }: { onSave?: () => void }) {
  const { accountId } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<any>(initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();
  
  const [address, setAddress] = useState('');
  const [location, setLocation] = useState<Omit<Location, 'address'> | null>(null);
  
  useEffect(() => {
    if (state?.message === 'success') {
      toast({
        title: "Sucesso!",
        description: "Novo cliente cadastrado.",
      });
      formRef.current?.reset();
      setAddress('');
      setLocation(null);
      setState(initialState);
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

  const action = (formData: FormData) => {
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
      <form ref={formRef} action={action} className="space-y-4 overflow-y-auto px-6 pb-4 flex-grow">
        {location && <input type="hidden" name="latitude" value={location.lat} />}
        {location && <input type="hidden" name="longitude" value={location.lng} />}
        
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
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" placeholder="contato@joao.com" />
          {state?.errors?.email && <p className="text-sm font-medium text-destructive">{state.errors.email[0]}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="address">Endereço Principal</Label>
          <div className="flex gap-2">
              <Textarea id="address" name="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua das Flores, 123, São Paulo, SP" required />
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
          <Textarea id="observations" name="observations" placeholder="Ex: Deixar caçamba na calçada, portão azul." />
          {state?.errors?.observations && <p className="text-sm font-medium text-destructive">{state.errors.observations[0]}</p>}
        </div>
      </form>
       <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <SubmitButton isPending={isPending} />
        </DialogFooter>
      </div>
  );
}
