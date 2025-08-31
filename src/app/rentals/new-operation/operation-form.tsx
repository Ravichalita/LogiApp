
'use client';

import { useEffect, useState, useTransition } from 'react';
import { createRental } from '@/lib/actions';
import type { Client, Dumpster, Location, UserAccount, Service } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CalendarIcon, User, AlertCircle, Truck, Check } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO, isBefore as isBeforeDate, startOfDay, addDays, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/context/auth-context';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AddressInput } from '@/components/address-input';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

const initialState = {
  errors: {},
  message: '',
};

function SubmitButton({ isPending }: { isPending: boolean }) {
  return (
    <Button type="submit" disabled={isPending} size="lg">
      {isPending ? <Spinner size="small" /> : 'Salvar Operação'}
    </Button>
  );
}

interface OperationFormProps {
  trucks: any[]; // Replace with actual Truck type
  clients: Client[];
  team: UserAccount[];
  services: Service[];
}

const formatCurrencyForInput = (valueInCents: string): string => {
    if (!valueInCents) return '0,00';
    const numericValue = parseInt(valueInCents.replace(/\D/g, ''), 10) || 0;
    const reais = Math.floor(numericValue / 100);
    const centavos = (numericValue % 100).toString().padStart(2, '0');
    return `${reais.toLocaleString('pt-BR')},${centavos}`;
};

const MultiSelect = ({ name, placeholder, options, onSelectionChange }: { name: string; placeholder: string; options: { value: string, label: string, icon: React.ElementType }[], onSelectionChange: (values: string[]) => void }) => {
    const [open, setOpen] = useState(false);
    const [selectedValues, setSelectedValues] = useState<string[]>([]);
    
    const toggleSelection = (value: string) => {
      const newSelection = selectedValues.includes(value) 
          ? selectedValues.filter(v => v !== value) 
          : [...selectedValues, value];
  
      setSelectedValues(newSelection);
      onSelectionChange(newSelection);
    }
  
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <input type="hidden" name={name} value={selectedValues.join(',')} />
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {selectedValues.length > 0
              ? `${selectedValues.length} selecionado(s)`
              : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput placeholder="Buscar..." />
            <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
            <CommandList>
              <CommandGroup>
                {options.map(option => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => toggleSelection(option.value)}
                  >
                    <div className={cn(
                      "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                      selectedValues.includes(option.value) ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible"
                    )}>
                      <Check className="h-4 w-4" />
                    </div>
                    <option.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{option.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  };


export function OperationForm({ trucks, clients, team, services }: OperationFormProps) {
  const { accountId, user, userAccount } = useAuth();
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  
  const [selectedTruckId, setSelectedTruckId] = useState<string | undefined>();
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>();
  const [assignedToId, setAssignedToId] = useState<string | undefined>(user?.uid);
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [operationDate, setOperationDate] = useState<Date | undefined>();
  const [location, setLocation] = useState<Omit<Location, 'address'> | null>(null);
  const [errors, setErrors] = useState<any>({});
  const [value, setValue] = useState('');
  const [serviceIds, setServiceIds] = useState<string[]>([]);

  const isViewer = userAccount?.role === 'viewer';
  const assignableUsers = isViewer && userAccount ? [userAccount] : team;

  useEffect(() => {
    setOperationDate(new Date());
    setAssignedToId(user?.uid)
  }, [user]);

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
  
  const handleAddressChange = (newAddress: string) => {
    setDeliveryAddress(newAddress);
  }

  const handleFormAction = (formData: FormData) => {
    startTransition(async () => {
        if (!accountId || !user) {
            toast({ title: "Erro", description: "Você precisa estar logado.", variant: "destructive" });
            return;
        }
        
        formData.set('deliveryAddress', deliveryAddress);
        if (operationDate) {
            formData.set('rentalDate', operationDate.toISOString());
            formData.set('returnDate', operationDate.toISOString()); // For operations, dates are the same
        }
        if (location) {
          formData.set('latitude', String(location.lat));
          formData.set('longitude', String(location.lng));
        }
        // Rename dumpsterId to truckId for clarity in operations
        if (selectedTruckId) formData.set('dumpsterId', selectedTruckId);
        formData.set('osType', 'operation');
        formData.set('serviceIds', serviceIds.join(','));


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
        if (result?.message && !result.errors) { // For general server errors
            toast({ title: "Erro", description: result.message, variant: "destructive"});
        }
    });
  };

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    setValue(formatCurrencyForInput(rawValue));
  }

  return (
    <form action={handleFormAction} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="truckId">Caminhão</Label>
        <Select name="truckId" onValueChange={setSelectedTruckId} required>
          <SelectTrigger>
            <SelectValue placeholder="Selecione um caminhão" />
          </SelectTrigger>
          <SelectContent>
            {trucks.map(t => (
              <SelectItem key={t.id} value={t.id}>
                <span>{`${t.model} (${t.licensePlate})`}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors?.truckId && <p className="text-sm font-medium text-destructive">{errors.truckId[0]}</p>}
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
        <Select name="assignedTo" value={assignedToId} onValueChange={setAssignedToId} required disabled={isViewer}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione um membro da equipe" />
          </SelectTrigger>
          <SelectContent>
            {assignableUsers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {errors?.assignedTo && <p className="text-sm font-medium text-destructive">{errors.assignedTo[0]}</p>}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="address-input">Endereço da Operação</Label>
        <AddressInput
            id="address-input"
            value={deliveryAddress}
            onInputChange={handleAddressChange}
            onLocationSelect={handleLocationSelect}
            initialLocation={location}
        />
        {errors?.deliveryAddress && <p className="text-sm font-medium text-destructive">{errors.deliveryAddress[0]}</p>}
      </div>
      
      <div className="space-y-2">
          <Label>Data da Operação</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !operationDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {operationDate ? format(operationDate, "PPP", { locale: ptBR }) : <span>Escolha uma data</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={operationDate}
                onSelect={setOperationDate}
                initialFocus
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
          {errors?.rentalDate && <p className="text-sm font-medium text-destructive">{errors.rentalDate[0]}</p>}
        </div>

      <div className="space-y-2">
        <Label htmlFor="services">Serviços</Label>
        <MultiSelect 
            name="serviceIds"
            placeholder="Selecione um ou mais serviços"
            options={services.map(s => ({ value: s.id, label: s.name, icon: User }))} // Replace User icon
            onSelectionChange={setServiceIds}
        />
      </div>


       <div className="space-y-2">
        <Label htmlFor="value">Valor Combinado (R$)</Label>
         <Input
            id="value"
            name="value"
            value={value}
            onChange={handleValueChange}
            placeholder="R$ 0,00"
            required
            className="text-right"
            />
        {errors?.value && <p className="text-sm font-medium text-destructive">{errors.value[0]}</p>}
      </div>

       <div className="space-y-2">
        <Label htmlFor="observations">Observações</Label>
        <Textarea id="observations" name="observations" placeholder="Ex: Detalhes específicos da operação." />
        {errors?.observations && <p className="text-sm font-medium text-destructive">{errors.observations[0]}</p>}
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
