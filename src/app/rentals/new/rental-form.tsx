'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { createRental } from '@/lib/actions';
import type { Client, Dumpster, Location } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MapDialog } from '@/components/map-dialog';
import { useAuth } from '@/context/auth-context';
import { Spinner } from '@/components/ui/spinner';

const initialState = {
  errors: {},
};

function SubmitButton({ isPending }: { isPending: boolean }) {
  return (
    <Button type="submit" disabled={isPending} className="w-full mt-4" size="lg">
      {isPending ? <Spinner size="small" /> : 'Salvar Aluguel'}
    </Button>
  );
}

interface RentalFormProps {
  dumpsters: Dumpster[];
  clients: Client[];
}

export function RentalForm({ dumpsters, clients }: RentalFormProps) {
  const { user } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [state, formAction] = useActionState(createRental.bind(null, user?.uid ?? ''), initialState);
  
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>();
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [rentalDate, setRentalDate] = useState<Date | undefined>();
  const [returnDate, setReturnDate] = useState<Date | undefined>();
  const [location, setLocation] = useState<Omit<Location, 'address'> | null>(null);

  useEffect(() => {
    // Initialize dates only on the client to avoid hydration mismatch
    setRentalDate(new Date());
  }, []);

  useEffect(() => {
    if (selectedClientId) {
      const client = clients.find(c => c.id === selectedClientId);
      if (client) {
         setDeliveryAddress(client.address);
         if (client.latitude && client.longitude) {
           setLocation({ lat: client.latitude, lng: client.longitude });
         } else {
           setLocation(null);
         }
      }
    } else {
       setDeliveryAddress('');
       setLocation(null);
    }
  }, [selectedClientId, clients]);
  
  const handleLocationSelect = (selectedLocation: Location) => {
    setLocation({ lat: selectedLocation.lat, lng: selectedLocation.lng });
    setDeliveryAddress(selectedLocation.address);
  };
  
  const handleFormAction = (formData: FormData) => {
    startTransition(() => {
        formAction(formData);
    });
  };

  return (
    <form action={handleFormAction} className="space-y-6">
      {/* Hidden inputs to pass date and location values to the server action */}
      {rentalDate && <input type="hidden" name="rentalDate" value={rentalDate.toISOString()} />}
      {returnDate && <input type="hidden" name="returnDate" value={returnDate.toISOString()} />}
      {location && <input type="hidden" name="latitude" value={location.lat} />}
      {location && <input type="hidden" name="longitude" value={location.lng} />}


      <div className="space-y-2">
        <Label htmlFor="dumpsterId">Caçamba</Label>
        <Select name="dumpsterId" required>
          <SelectTrigger>
            <SelectValue placeholder="Selecione uma caçamba disponível" />
          </SelectTrigger>
          <SelectContent>
            {dumpsters.map(d => <SelectItem key={d.id} value={d.id}>{`${d.name} (${d.size}m³, ${d.color})`}</SelectItem>)}
          </SelectContent>
        </Select>
        {state?.errors?.dumpsterId && <p className="text-sm font-medium text-destructive">{state.errors.dumpsterId[0]}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="clientId">Cliente</Label>
        <Select name="clientId" onValueChange={setSelectedClientId} value={selectedClientId} required>
          <SelectTrigger>
            <SelectValue placeholder="Selecione um cliente" />
          </SelectTrigger>
          <SelectContent>
            {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {state?.errors?.clientId && <p className="text-sm font-medium text-destructive">{state.errors.clientId[0]}</p>}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="deliveryAddress">Endereço de Entrega</Label>
        <div className="flex gap-2">
          <Input id="deliveryAddress" name="deliveryAddress" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="Informe o endereço ou selecione no mapa" required />
          <MapDialog onLocationSelect={handleLocationSelect} />
        </div>
         {location && (
          <p className="text-sm text-muted-foreground">
            Coordenadas selecionadas: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
          </p>
        )}
        {state?.errors?.deliveryAddress && <p className="text-sm font-medium text-destructive">{state.errors.deliveryAddress[0]}</p>}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Data de Entrega</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !rentalDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {rentalDate ? format(rentalDate, "PPP", { locale: ptBR }) : <span>Escolha uma data</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={rentalDate}
                onSelect={setRentalDate}
                initialFocus
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
          {state?.errors?.rentalDate && <p className="text-sm font-medium text-destructive">{state.errors.rentalDate[0]}</p>}
        </div>
        <div className="space-y-2">
          <Label>Data de Retirada (Prevista)</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !returnDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {returnDate ? format(returnDate, "PPP", { locale: ptBR }) : <span>Escolha uma data</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={returnDate}
                onSelect={setReturnDate}
                disabled={(date) => rentalDate ? date <= rentalDate : false}
                initialFocus
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
           {state?.errors?.returnDate && <p className="text-sm font-medium text-destructive">{state.errors.returnDate[0]}</p>}
        </div>
      </div>

      <SubmitButton isPending={isPending} />
    </form>
  );
}
