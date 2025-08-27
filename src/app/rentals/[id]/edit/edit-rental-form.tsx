
'use client';

import { useEffect, useState, useTransition } from 'react';
import { updateRentalAction } from '@/lib/actions';
import type { Client, PopulatedRental, Location, UserAccount, RentalPrice } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format, isBefore as isBeforeDate, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/context/auth-context';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { AddressInput } from '@/components/address-input';

interface EditRentalFormProps {
  rental: PopulatedRental;
  clients: Client[];
  team: UserAccount[];
  rentalPrices?: RentalPrice[];
}

const formatCurrencyForInput = (valueInCents: string): string => {
    if (!valueInCents) return '0,00';
    const numericValue = parseInt(valueInCents.replace(/\D/g, ''), 10) || 0;
    const reais = Math.floor(numericValue / 100);
    const centavos = (numericValue % 100).toString().padStart(2, '0');
    return `${reais.toLocaleString('pt-BR')},${centavos}`;
};

const formatCurrencyForDisplay = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export function EditRentalForm({ rental, clients, team, rentalPrices }: EditRentalFormProps) {
  const { accountId } = useAuth();
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  
  const [assignedToId, setAssignedToId] = useState<string | undefined>(rental.assignedToUser?.id);
  const [deliveryAddress, setDeliveryAddress] = useState<string>(rental.deliveryAddress);
  const [rentalDate, setRentalDate] = useState<Date | undefined>(parseISO(rental.rentalDate));
  const [returnDate, setReturnDate] = useState<Date | undefined>(parseISO(rental.returnDate));
  const [location, setLocation] = useState<Omit<Location, 'address'> | null>(
    rental.latitude && rental.longitude ? { lat: rental.latitude, lng: rental.longitude } : null
  );
  const [errors, setErrors] = useState<any>({});
  const [value, setValue] = useState(formatCurrencyForInput((rental.value * 100).toString()));
  const [priceId, setPriceId] = useState<string | undefined>();
  
  const handleLocationSelect = (selectedLocation: Location) => {
    setLocation({ lat: selectedLocation.lat, lng: selectedLocation.lng });
    setDeliveryAddress(selectedLocation.address);
  };
  
  const handleAddressChange = (newAddress: string) => {
    setDeliveryAddress(newAddress);
  }

  const handleFormAction = (formData: FormData) => {
    startTransition(async () => {
        if (!accountId) {
            toast({ title: "Erro", description: "Você precisa estar logado.", variant: "destructive" });
            return;
        }
        
        formData.set('id', rental.id);
        formData.set('deliveryAddress', deliveryAddress);
        if (rentalDate) formData.set('rentalDate', rentalDate.toISOString());
        if (returnDate) formData.set('returnDate', returnDate.toISOString());
        if (location) {
          formData.set('latitude', String(location.lat));
          formData.set('longitude', String(location.lng));
        }
        formData.set('value', value); // Send the formatted string, server action will parse it

        const boundAction = updateRentalAction.bind(null, accountId);
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
        if (result?.message && result.message !== 'success' && !result.errors) {
            toast({ title: "Erro", description: result.message, variant: "destructive"});
        }
    });
  };

  const handlePriceSelection = (selectedPriceId: string) => {
    setPriceId(selectedPriceId);
    const selectedPrice = rentalPrices?.find(p => p.id === selectedPriceId);
    if(selectedPrice) {
        const valueInCents = (selectedPrice.value * 100).toString();
        setValue(formatCurrencyForInput(valueInCents));
    }
  }
  
  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    setValue(formatCurrencyForInput(rawValue));
  }

  return (
    <form action={handleFormAction} className="space-y-6">
        {/* Hidden inputs to pass data not directly in a form field */}
        <input type="hidden" name="clientId" value={rental.clientId} />
        <input type="hidden" name="dumpsterId" value={rental.dumpsterId} />

      <div className="space-y-2">
        <Label>Caçamba</Label>
        <Input value={`${rental.dumpster?.name} (${rental.dumpster?.size}m³)`} disabled />
      </div>

      <div className="space-y-2">
        <Label>Cliente</Label>
        <Input value={rental.client?.name} disabled />
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
        <Label htmlFor="address-input">Endereço de Entrega</Label>
        <AddressInput
            id="address-input"
            initialValue={deliveryAddress}
            onInputChange={handleAddressChange}
            onLocationSelect={handleLocationSelect}
            initialLocation={location}
        />
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
                disabled={!rentalDate}
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
                disabled={(date) => rentalDate ? isBeforeDate(date, rentalDate) : true}
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
        {(rentalPrices && rentalPrices.length > 0) ? (
            <div className="flex gap-2">
                <Select onValueChange={handlePriceSelection} value={priceId}>
                     <SelectTrigger>
                        <SelectValue placeholder="Selecione uma tabela de preço" />
                    </SelectTrigger>
                    <SelectContent>
                        {rentalPrices.map(p => (
                            <SelectItem key={p.id} value={p.id}>
                                {p.name} ({formatCurrencyForDisplay(p.value)})
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                 <Input
                    id="value"
                    name="value"
                    value={value}
                    onChange={handleValueChange}
                    placeholder="R$ 0,00"
                    required
                    className="w-1/3 text-right"
                    />
            </div>
        ) : (
            <Input
            id="value"
            name="value"
            value={value}
            onChange={handleValueChange}
            placeholder="R$ 0,00"
            required
            className="text-right"
            />
        )}
        {errors?.value && <p className="text-sm font-medium text-destructive">{errors.value[0]}</p>}
      </div>

      <div className="flex flex-col sm:flex-row-reverse gap-2 pt-4">
        <Button type="submit" disabled={isPending} size="lg">
          {isPending ? <Spinner size="small" /> : 'Salvar Alterações'}
        </Button>
        <Button asChild variant="outline" size="lg">
            <Link href="/">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
