

'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import { createServiceOrderAction } from '@/lib/actions';
import type { Client, Location, UserAccount, Service, Account, DirectionsResponse, Truck } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CalendarIcon, User, Truck as TruckIcon, Check, Clock, Route, Milestone } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { set } from 'date-fns';
import { format } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/context/auth-context';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AddressInput } from '@/components/address-input';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { MapDialog } from '@/components/map-dialog';
import { getDirectionsAction } from '@/lib/data-server-actions';

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
  trucks: Truck[];
  clients: Client[];
  team: UserAccount[];
  services: Service[];
  account: Account | null;
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

const generateTimeOptions = () => {
    const options = [];
    for (let i = 0; i < 24; i++) {
        options.push(`${i.toString().padStart(2, '0')}:00`);
        options.push(`${i.toString().padStart(2, '0')}:30`);
    }
    return options;
};

export function OperationForm({ trucks, clients, team, services, account }: OperationFormProps) {
  const { accountId, user, userAccount } = useAuth();
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  
  const [selectedTruckId, setSelectedTruckId] = useState<string | undefined>();
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>();
  const [assignedToId, setAssignedToId] = useState<string | undefined>(user?.uid);
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [operationDate, setOperationDate] = useState<Date | undefined>();
  const [operationTime, setOperationTime] = useState<string>('08:00');
  const [location, setLocation] = useState<Omit<Location, 'address'> | null>(null);
  const [errors, setErrors] = useState<any>({});
  const [value, setValue] = useState('');
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  
  const [directions, setDirections] = useState<DirectionsResponse | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);

  const isViewer = userAccount?.role === 'viewer';
  const assignableUsers = isViewer && userAccount ? [userAccount] : team;
  const timeOptions = generateTimeOptions();
  const baseLocation = account?.baseLocation;

  useEffect(() => {
    setOperationDate(new Date());
    setAssignedToId(user?.uid)
  }, [user]);

  const calculateRoute = useCallback(async (destination: { lat: number, lng: number }) => {
    if (!baseLocation) return;
    setIsCalculatingRoute(true);
    setDirections(null);
    const result = await getDirectionsAction(baseLocation, destination);
    if ('error' in result) {
        toast({ title: "Erro de Rota", description: result.error, variant: 'destructive'});
    } else {
        setDirections(result);
    }
    setIsCalculatingRoute(false);
  }, [baseLocation, toast]);

  const handleLocationSelect = useCallback((selectedLocation: Location) => {
    const newLocation = { lat: selectedLocation.lat, lng: selectedLocation.lng };
    setLocation(newLocation);
    setDeliveryAddress(selectedLocation.address);
    if (baseLocation) {
        calculateRoute(newLocation);
    }
  }, [baseLocation, calculateRoute]);

  useEffect(() => {
    if (selectedClientId) {
      const client = clients.find(c => c.id === selectedClientId);
      if (client) {
         setDeliveryAddress(client.address);
         if (client.latitude && client.longitude) {
            const newLocation = { lat: client.latitude, lng: client.longitude };
            setLocation(newLocation);
            if (baseLocation) calculateRoute(newLocation);
         } else {
           setLocation(null);
           setDirections(null);
         }
      }
    } else {
       setDeliveryAddress('');
       setLocation(null);
       setDirections(null);
    }
  }, [selectedClientId, clients, baseLocation, calculateRoute]);

  const handleAddressChange = (newAddress: string) => {
    setDeliveryAddress(newAddress);
    if(directions) setDirections(null); // Clear directions if address is manually changed
  }

  const handleFormAction = (formData: FormData) => {
    startTransition(async () => {
        if (!accountId || !user) {
            toast({ title: "Erro", description: "Você precisa estar logado.", variant: "destructive" });
            return;
        }
        
        let combinedDate: Date | undefined = undefined;
        if (operationDate) {
            const [hours, minutes] = operationTime.split(':').map(Number);
            combinedDate = set(operationDate, { hours, minutes });
        }

        formData.set('deliveryAddress', deliveryAddress);
        if (combinedDate) {
            formData.set('rentalDate', combinedDate.toISOString());
            formData.set('returnDate', combinedDate.toISOString());
        } else if (operationDate) {
            formData.set('rentalDate', operationDate.toISOString());
            formData.set('returnDate', operationDate.toISOString());
        }

        if (location) {
          formData.set('latitude', String(location.lat));
          formData.set('longitude', String(location.lng));
        }
        
        formData.set('osType', 'operation');
        formData.set('serviceIds', serviceIds.join(','));
        if (directions) {
            formData.set('distance', String(directions.distance.value));
        }


        const boundAction = createServiceOrderAction.bind(null, accountId, user.uid);
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
        if (result?.message && !result.errors) {
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
                <span>{t.model} ({t.licensePlate})</span>
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
        <div className="flex justify-between items-center">
            <Label htmlFor="address-input">Endereço da Operação</Label>
             {directions && (
                <div className="flex items-center text-xs font-medium text-muted-foreground">
                    <Route className="h-4 w-4 mr-1" />
                    Distância: {directions.distance.text}
                </div>
            )}
        </div>
        <AddressInput
            id="address-input"
            value={deliveryAddress}
            onInputChange={handleAddressChange}
            onLocationSelect={handleLocationSelect}
            initialLocation={location}
        />
        {errors?.deliveryAddress && <p className="text-sm font-medium text-destructive">{errors.deliveryAddress[0]}</p>}
        {isCalculatingRoute && <div className="flex items-center text-sm text-muted-foreground"><Spinner size="small" /> Calculando rota...</div>}
        {directions && baseLocation && location && (
            <div className="flex items-center text-sm text-muted-foreground gap-2">
                <Route className="h-4 w-4" />
                <span>Distância: <b>{directions.distance.text}</b></span>
                <Clock className="h-4 w-4" />
                <span>Duração: <b>{directions.duration.text}</b></span>
                 <MapDialog onLocationSelect={() => {}} origin={baseLocation} destination={location} />
            </div>
        )}
      </div>
      
      <div className="space-y-2">
        <Label>Data e Hora da Operação</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
             <Select value={operationTime} onValueChange={setOperationTime}>
                <SelectTrigger>
                    <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <SelectValue />
                    </div>
                </SelectTrigger>
                <SelectContent>
                    {timeOptions.map(time => (
                        <SelectItem key={time} value={time}>{time}</SelectItem>
                    ))}
                </SelectContent>
             </Select>
        </div>
        {(errors?.rentalDate || errors?.returnDate) && <p className="text-sm font-medium text-destructive">{errors.rentalDate?.[0] || errors.returnDate?.[0]}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="services">Serviços</Label>
        <MultiSelect 
            name="serviceIds"
            placeholder="Selecione um ou mais serviços"
            options={services.map(s => ({ value: s.id, label: s.name, icon: Milestone }))}
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
