
'use client';

import { useEffect, useState, useTransition } from 'react';
import { createRental } from '@/lib/actions';
import type { Client, Dumpster, Location, UserAccount } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CalendarIcon, User } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MapDialog } from '@/components/map-dialog';
import { useAuth } from '@/context/auth-context';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

const initialState = {
  errors: {},
  message: '',
};

export type DumpsterForForm = Dumpster & { availableUntil?: Date };

function SubmitButton({ isPending }: { isPending: boolean }) {
  return (
    <Button type="submit" disabled={isPending} size="lg">
      {isPending ? <Spinner size="small" /> : 'Salvar Aluguel'}
    </Button>
  );
}

interface RentalFormProps {
  dumpsters: DumpsterForForm[];
  clients: Client[];
  team: UserAccount[];
  defaultPrice?: number;
}

const formatCurrencyInput = (value: number | string) => {
    if (typeof value === 'number') {
        value = value.toFixed(2);
    }
    let inputValue = String(value).replace(/\D/g, '');
    if (!inputValue) return '';
    inputValue = (Number(inputValue) / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
    return inputValue;
};


export function RentalForm({ dumpsters, clients, team, defaultPrice }: RentalFormProps) {
  const { accountId, user } = useAuth();
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>();
  const [assignedToId, setAssignedToId] = useState<string | undefined>(user?.uid);
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [rentalDate, setRentalDate] = useState<Date | undefined>();
  const [returnDate, setReturnDate] = useState<Date | undefined>();
  const [location, setLocation] = useState<Omit<Location, 'address'> | null>(null);
  const [errors, setErrors] = useState<any>({});
  const [value, setValue] = useState('');

  useEffect(() => {
    // Initialize dates only on the client to avoid hydration mismatch
    setRentalDate(new Date());
    setAssignedToId(user?.uid)
    if(defaultPrice) {
        setValue(formatCurrencyInput(defaultPrice));
    }
  }, [user, defaultPrice]);

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
    startTransition(async () => {
        if (!accountId || !user) {
            toast({ title: "Erro", description: "Você precisa estar logado.", variant: "destructive" });
            return;
        }
        
        if (rentalDate) formData.set('rentalDate', rentalDate.toISOString());
        if (returnDate) formData.set('returnDate', returnDate.toISOString());
        if (location) {
          formData.set('latitude', String(location.lat));
          formData.set('longitude', String(location.lng));
        }

        const boundAction = createRental.bind(null, accountId, user.uid);
        const result = await boundAction(null, formData);

        if (result?.errors) {
            setErrors(result.errors);
             const errorMessages = Object.values(result.errors).flat().join(' ');
             toast({
                title: "Erro de Validação",
                description: errorMessages,
                variant: "destructive"
             })
        }
        if (result?.message) { // For general server errors
            toast({ title: "Erro", description: result.message, variant: "destructive"});
        }
    });
  };

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(formatCurrencyInput(e.target.value));
  };

  return (
    <form action={handleFormAction} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="dumpsterId">Caçamba</Label>
        <Select name="dumpsterId" required>
          <SelectTrigger>
            <SelectValue placeholder="Selecione uma caçamba disponível" />
          </SelectTrigger>
          <SelectContent>
            {dumpsters.map(d => (
              <SelectItem key={d.id} value={d.id}>
                <div className="flex justify-between w-full">
                    <span>{`${d.name} (${d.size}m³, ${d.color})`}</span>
                    {d.availableUntil && (
                      <span className="text-xs text-muted-foreground ml-4">
                        Disponível até {format(d.availableUntil, "dd/MM/yy")}
                      </span>
                    )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors?.dumpsterId && <p className="text-sm font-medium text-destructive">{errors.dumpsterId[0]}</p>}
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
        {errors?.clientId && <p className="text-sm font-medium text-destructive">{errors.clientId[0]}</p>}
      </div>
      
       <div className="space-y-2">
        <Label htmlFor="assignedTo">Designar para</Label>
        <Select name="assignedTo" value={assignedToId} onValueChange={setAssignedToId} required>
          <SelectTrigger>
            <SelectValue placeholder="Selecione um membro da equipe" />
          </SelectTrigger>
          <SelectContent>
            {team.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {errors?.assignedTo && <p className="text-sm font-medium text-destructive">{errors.assignedTo[0]}</p>}
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
        {errors?.deliveryAddress && <p className="text-sm font-medium text-destructive">{errors.deliveryAddress[0]}</p>}
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
          {errors?.rentalDate && <p className="text-sm font-medium text-destructive">{errors.rentalDate[0]}</p>}
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
           {errors?.returnDate && <p className="text-sm font-medium text-destructive">{errors.returnDate[0]}</p>}
        </div>
      </div>
       <div className="space-y-2">
        <Label htmlFor="value">Valor da Diária (R$)</Label>
        <Input
          id="value"
          name="value"
          value={value}
          onChange={handleValueChange}
          placeholder="R$ 0,00"
          required
        />
        {errors?.value && <p className="text-sm font-medium text-destructive">{errors.value[0]}</p>}
      </div>

      <div className="flex flex-col sm:flex-row-reverse gap-2 pt-4">
        <SubmitButton isPending={isPending} />
        <Button asChild variant="outline" size="lg">
            <Link href="/">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
