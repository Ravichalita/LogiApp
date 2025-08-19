'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { createRental } from '@/lib/actions';
import type { Client, Dumpster } from '@/lib/types';
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
import { useEffect, useState } from 'react';

const initialState = {
  errors: {},
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full mt-4" size="lg">
      {pending ? 'Salvando...' : 'Salvar Aluguel'}
    </Button>
  );
}

interface RentalFormProps {
  dumpsters: Dumpster[];
  clients: Client[];
}

export function RentalForm({ dumpsters, clients }: RentalFormProps) {
  const [state, formAction] = useActionState(createRental, initialState);
  
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [rentalDate, setRentalDate] = useState<Date>();
  const [returnDate, setReturnDate] = useState<Date>();

  useEffect(() => {
    setRentalDate(new Date());
  }, []);

  useEffect(() => {
    const client = clients.find(c => c.id === selectedClientId);
    if (client) {
      setDeliveryAddress(client.address);
    } else {
      setDeliveryAddress('');
    }
  }, [selectedClientId, clients]);

  return (
    <form action={formAction} className="space-y-6">
      {/* Hidden inputs to pass date values to the server action */}
      {rentalDate && <input type="hidden" name="rentalDate" value={rentalDate.toISOString()} />}
      {returnDate && <input type="hidden" name="returnDate" value={returnDate.toISOString()} />}

      <div className="space-y-2">
        <Label htmlFor="dumpsterId">Caçamba</Label>
        <Select name="dumpsterId" required>
          <SelectTrigger>
            <SelectValue placeholder="Selecione uma caçamba disponível" />
          </SelectTrigger>
          <SelectContent>
            {dumpsters.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
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
        <Input id="deliveryAddress" name="deliveryAddress" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="Informe o endereço de entrega" required />
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

      <SubmitButton />
    </form>
  );
}
