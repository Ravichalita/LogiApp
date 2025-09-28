
'use client';

import { useEffect, useState, useTransition, useRef, useMemo } from 'react';
import { createRental } from '@/lib/actions';
import type { Client, Dumpster, Location, UserAccount, RentalPrice, Attachment, Account, Base, AdditionalCost, Truck } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CalendarIcon, User, AlertCircle, MapPin, Warehouse, Route, Clock, Sun, CloudRain, Cloudy, Snowflake, DollarSign, Map as MapIcon, TrendingDown, TrendingUp, Plus, ChevronsUpDown, Check, ListFilter, Star, Building, ShieldCheck } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO, isBefore as isBeforeDate, startOfToday, addDays, isSameDay, differenceInCalendarDays, set, addHours, isWithinInterval, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/context/auth-context';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AddressInput } from '@/components/address-input';
import { AttachmentsUploader } from '@/components/attachments-uploader';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { geocodeAddress, getDirectionsAction, getWeatherForecastAction } from '@/lib/data-server-actions';
import { MapDialog } from '@/components/map-dialog';
import { Separator } from '@/components/ui/separator';
import { CostsDialog } from '@/app/operations/new/costs-dialog';
import { useRouter } from 'next/navigation';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';


const initialState = {
  errors: {},
  message: '',
};

export type DumpsterForForm = Dumpster & { 
  specialStatus?: string;
  disabled: boolean;
  disabledRanges: { from: Date; to: Date }[];
  schedules: string[];
};

function SubmitButton({ isPending }: { isPending: boolean }) {
  return (
    <Button type="submit" disabled={isPending} size="lg">
      {isPending ? <Spinner size="small" /> : 'Salvar OS'}
    </Button>
  );
}

interface RentalFormProps {
  dumpsters: DumpsterForForm[];
  clients: Client[];
  classifiedClients: {
    newClients: Client[];
    activeClients: Client[];
    completedClients: Client[];
    unservedClients: Client[];
  };
  team: UserAccount[];
  trucks: Truck[];
  rentalPrices?: RentalPrice[];
  account: Account | null;
  prefillData?: any;
  swapOriginId?: string | null;
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

const WeatherIcon = ({ condition }: { condition: string }) => {
    const lowerCaseCondition = condition.toLowerCase();
    if (lowerCaseCondition.includes('chuva') || lowerCaseCondition.includes('rain')) {
        return <CloudRain className="h-5 w-5" />;
    }
    if (lowerCaseCondition.includes('neve') || lowerCaseCondition.includes('snow')) {
        return <Snowflake className="h-5 w-5" />;
    }
    if (lowerCaseCondition.includes('nublado') || lowerCaseCondition.includes('cloudy')) {
        return <Cloudy className="h-5 w-5" />;
    }
    return <Sun className="h-5 w-5" />;
};


export function RentalForm({ dumpsters, clients, classifiedClients, team, trucks, rentalPrices, account, prefillData, swapOriginId }: RentalFormProps) {
  const { accountId, user, userAccount, isSuperAdmin } = useAuth();
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();
  
  const [selectedDumpsterIds, setSelectedDumpsterIds] = useState<string[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>(prefillData?.clientId);
  const [selectedTruckId, setSelectedTruckId] = useState<string | undefined>();
  const [assignedToId, setAssignedToId] = useState<string | undefined>(prefillData?.assignedTo || userAccount?.id);
  
  const defaultBase = account?.bases?.[0];
  const [selectedBaseId, setSelectedBaseId] = useState<string | undefined>(defaultBase?.id);
  const [startAddress, setStartAddress] = useState(prefillData?.startAddress || defaultBase?.address || '');
  const [startLocation, setStartLocation] = useState<Omit<Location, 'address'> | null>(
    prefillData?.startLatitude && prefillData?.startLongitude
      ? { lat: prefillData.startLatitude, lng: prefillData.startLongitude }
      : (defaultBase?.latitude && defaultBase.longitude ? { lat: defaultBase.latitude, lng: defaultBase.longitude } : null)
  );
  
  const [deliveryAddress, setDeliveryAddress] = useState<string>(prefillData?.deliveryAddress || '');
  const [deliveryLocation, setDeliveryLocation] = useState<Omit<Location, 'address'> | null>(
    prefillData?.latitude && prefillData?.longitude
      ? { lat: prefillData.latitude, lng: prefillData.longitude }
      : null
  );

  const [rentalDate, setRentalDate] = useState<Date | undefined>(prefillData ? new Date() : undefined);
  const [returnDate, setReturnDate] = useState<Date | undefined>(prefillData ? addDays(new Date(), 2) : undefined);
  
  const [errors, setErrors] = useState<any>({});
  const [value, setValue] = useState(prefillData?.value || 0); // Store value as a number
  const [lumpSumValue, setLumpSumValue] = useState(prefillData?.lumpSumValue || 0);
  const [billingType, setBillingType] = useState<'perDay' | 'lumpSum'>(prefillData?.billingType || 'perDay');
  
  const [displayValue, setDisplayValue] = useState(prefillData?.value ? formatCurrencyForInput((prefillData.value * 100).toString()) : ''); // Store formatted string for input
  const [displayLumpSumValue, setDisplayLumpSumValue] = useState(prefillData?.lumpSumValue ? formatCurrencyForInput((prefillData.lumpSumValue * 100).toString()) : '');
  
  const [priceId, setPriceId] = useState<string | undefined>();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [additionalCosts, setAdditionalCosts] = useState<AdditionalCost[]>([]);
  
  const [directions, setDirections] = useState<{ distanceMeters: number, durationSeconds: number, distance: string, duration: string } | null>(null);
  const [weather, setWeather] = useState<{ condition: string; tempC: number } | null>(null);
  const [travelCost, setTravelCost] = useState<number | null>(null);
  const [isFetchingInfo, setIsFetchingInfo] = useState(false);

  const [dumpsterSelectOpen, setDumpsterSelectOpen] = useState(false);
  const [clientSelectOpen, setClientSelectOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [openAccordionGroups, setOpenAccordionGroups] = useState<string[]>([]);

  const [isRentalDateOpen, setIsRentalDateOpen] = useState(false);
  const [isReturnDateOpen, setIsReturnDateOpen] = useState(false);

  const isViewer = userAccount?.role === 'viewer';
  const assignableUsers = isViewer && userAccount ? [userAccount] : team;
  const canUseAttachments = isSuperAdmin || userAccount?.permissions?.canUseAttachments;

  // Financial calculations
  const rentalDays = returnDate && rentalDate ? differenceInCalendarDays(returnDate, rentalDate) + 1 : 0;
  const totalRentalValue = billingType === 'lumpSum' ? lumpSumValue : value * rentalDays * selectedDumpsterIds.length;
  const totalOperationCost = (travelCost || 0) + additionalCosts.reduce((acc, cost) => acc + cost.value, 0);
  const profit = totalRentalValue - totalOperationCost;


  const poliguindasteTrucks = useMemo(() => 
    trucks.filter(t => t.type?.toLowerCase().includes('poliguindaste')), 
  [trucks]);

  useEffect(() => {
    if (poliguindasteTrucks.length === 1 && !selectedTruckId) {
      setSelectedTruckId(poliguindasteTrucks[0].id);
    }
  }, [poliguindasteTrucks, selectedTruckId]);

  useEffect(() => {
    if (!prefillData) {
        setRentalDate(new Date());
        setReturnDate(addDays(new Date(), 2));
    }
    setAssignedToId(prefillData?.assignedTo || userAccount?.id)
  }, [userAccount, prefillData]);

   useEffect(() => {
        if (!startLocation && startAddress) {
            geocodeAddress(startAddress).then(location => {
                if (location) {
                    setStartLocation({ lat: location.lat, lng: location.lng });
                }
            });
        }
    }, [startAddress, startLocation]);

  useEffect(() => {
    if (selectedClientId) {
      const client = clients.find(c => c.id === selectedClientId);
      if (client && !prefillData?.deliveryAddress) { // Don't override prefilled address
         setDeliveryAddress(client.address);
         if (client.latitude && client.longitude) {
           setDeliveryLocation({ lat: client.latitude, lng: client.longitude });
         } else {
           setDeliveryLocation(null);
           geocodeAddress(client.address).then(location => {
                if (location) setDeliveryLocation({ lat: location.lat, lng: location.lng });
            });
         }
      }
    } else if (!prefillData) { // Clear only if not prefilling
       setDeliveryAddress('');
       setDeliveryLocation(null);
    }
  }, [selectedClientId, clients, prefillData]);
  
  useEffect(() => {
    const fetchRouteInfo = async () => {
      if (startLocation && deliveryLocation && rentalDate) {
        setIsFetchingInfo(true);
        setDirections(null);
        setWeather(null);
        setTravelCost(null);
        try {
          const [directionsResult, weatherResult] = await Promise.all([
             getDirectionsAction(startLocation, deliveryLocation),
             getWeatherForecastAction(deliveryLocation, rentalDate),
          ]);
          if (directionsResult) {
            setDirections(directionsResult);
            const truckType = account?.truckTypes.find(t => t.name.toLowerCase().includes('poliguindaste'));

            if (truckType) {
                let costConfig = account?.operationalCosts.find(c => c.baseId === selectedBaseId && c.truckTypeId === truckType.id);
                if (!costConfig) {
                    costConfig = account?.operationalCosts.find(c => c.truckTypeId === truckType.id);
                }

                const costPerKm = costConfig?.value || 0;
                
                if (costPerKm > 0) {
                    setTravelCost((directionsResult.distanceMeters / 1000) * 2 * costPerKm); // Ida e volta
                } else {
                    setTravelCost(0);
                }
            } else {
                setTravelCost(0);
            }
          }
          if (weatherResult) {
              setWeather(weatherResult);
          }
        } catch (error) {
          console.error(error);
        } finally {
          setIsFetchingInfo(false);
        }
      } else {
          setDirections(null);
          setWeather(null);
          setTravelCost(null);
      }
    };

    fetchRouteInfo();
  }, [startLocation, deliveryLocation, rentalDate, account, selectedBaseId]);
  
  const handleBaseSelect = (baseId: string) => {
    setSelectedBaseId(baseId);
    const selectedBase = account?.bases?.find(b => b.id === baseId);
    if (selectedBase) {
        setStartAddress(selectedBase.address);
         if (selectedBase.latitude && selectedBase.longitude) {
            setStartLocation({ lat: selectedBase.latitude, lng: selectedBase.longitude });
        } else {
            setStartLocation(null); 
            geocodeAddress(selectedBase.address).then(location => {
                if (location) {
                    setStartLocation({ lat: location.lat, lng: location.lng });
                }
            });
        }
    }
  };
  
  const handleStartLocationSelect = (selectedLocation: Location) => {
    setStartLocation({ lat: selectedLocation.lat, lng: selectedLocation.lng });
    setStartAddress(selectedLocation.address);
    setSelectedBaseId(undefined); // Clear base selection if custom address is chosen
  };
  
  const handleStartAddressChange = (newAddress: string) => {
    setStartAddress(newAddress);
    setStartLocation(null);
    setSelectedBaseId(undefined); // Clear base selection if custom address is chosen
  }
  
  const handleDeliveryLocationSelect = (selectedLocation: Location) => {
    setDeliveryLocation({ lat: selectedLocation.lat, lng: selectedLocation.lng });
    setDeliveryAddress(selectedLocation.address);
  };
  
  const handleDeliveryAddressChange = (newAddress: string) => {
    setDeliveryAddress(newAddress);
    setDeliveryLocation(null);
  }

  const handleFormAction = (formData: FormData) => {
    startTransition(async () => {
        if (!accountId || !user) {
            toast({ title: "Erro", description: "Você precisa estar logado.", variant: "destructive" });
            return;
        }
        
        formData.set('dumpsterIds', JSON.stringify(selectedDumpsterIds));
        if (selectedClientId) formData.set('clientId', selectedClientId);
        if (selectedTruckId) formData.set('truckId', selectedTruckId);
        if (assignedToId) formData.set('assignedTo', assignedToId);
        
        formData.set('startAddress', startAddress);
        if (startLocation) {
          formData.set('startLatitude', String(startLocation.lat));
          formData.set('startLongitude', String(startLocation.lng));
        }
        
        formData.set('deliveryAddress', deliveryAddress);
        if (deliveryLocation) {
          formData.set('latitude', String(deliveryLocation.lat));
          formData.set('longitude', String(deliveryLocation.lng));
        }
        
        if (rentalDate) formData.set('rentalDate', rentalDate.toISOString());
        if (returnDate) formData.set('returnDate', returnDate.toISOString());
        
        formData.set('billingType', billingType);
        formData.set('value', String(value));
        formData.set('lumpSumValue', String(lumpSumValue));

        formData.set('attachments', JSON.stringify(attachments));
        formData.set('additionalCosts', JSON.stringify(additionalCosts));

        const calculatedTravelCost = travelCost || 0;
        const calculatedTotalCost = totalOperationCost;
        formData.set('travelCost', String(calculatedTravelCost));
        formData.set('totalCost', String(calculatedTotalCost));

        if (swapOriginId) {
            formData.set('swapOriginId', swapOriginId);
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
        if (result?.message && !result.errors) { // For general server errors
            toast({ title: "Erro", description: result.message, variant: "destructive"});
        }
    });
  };
  
  const handleAttachmentUploaded = (newAttachment: Attachment) => {
    setAttachments(prev => [...prev, newAttachment]);
  };

  const handleRemoveAttachment = (attachmentToRemove: Attachment) => {
    setAttachments(prev => prev.filter(att => att.url !== attachmentToRemove.url));
  };

  const handlePriceSelection = (selectedPriceId: string) => {
    setPriceId(selectedPriceId);
    const selectedPrice = rentalPrices?.find(p => p.id === selectedPriceId);
    if(selectedPrice) {
        setValue(selectedPrice.value);
        setDisplayValue(formatCurrencyForInput((selectedPrice.value * 100).toString()));
    }
  }
  
  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    const cents = parseInt(rawValue, 10) || 0;
    setValue(cents / 100);
    setDisplayValue(formatCurrencyForInput(rawValue));
  }
  
  const handleLumpSumValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    const cents = parseInt(rawValue, 10) || 0;
    setLumpSumValue(cents / 100);
    setDisplayLumpSumValue(formatCurrencyForInput(rawValue));
  }
  
  const handleAccordionChange = (value: string) => {
    const newBillingType = value === 'lump-sum' ? 'lumpSum' : 'perDay';
    setBillingType(newBillingType);
    if (newBillingType === 'perDay') {
        setLumpSumValue(0);
        setDisplayLumpSumValue('');
    } else {
        setValue(0);
        setDisplayValue('');
        setPriceId(undefined);
    }
  };
  
  const handleClientSelect = (clientId: string) => {
    if (clientId === 'add-new-client') {
        router.push('/clients/new');
        return;
    }
    setSelectedClientId(clientId);
    setClientSelectOpen(false);
  }
  
  const filterClients = (clients: Client[], search: string) => {
    if (!search) return clients;
    return clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  }

  const filteredNewClients = filterClients(classifiedClients.newClients, clientSearch);
  const filteredActiveClients = filterClients(classifiedClients.activeClients, clientSearch);
  const filteredCompletedClients = filterClients(classifiedClients.completedClients, clientSearch);
  const filteredUnservedClients = filterClients(classifiedClients.unservedClients, clientSearch);
  
  useEffect(() => {
    if (clientSearch) {
        const groupsToOpen: string[] = [];
        if (filteredCompletedClients.length > 0) groupsToOpen.push('completed');
        if (filteredUnservedClients.length > 0) groupsToOpen.push('unserved');
        setOpenAccordionGroups(groupsToOpen);
    } else {
        setOpenAccordionGroups([]);
    }
  }, [clientSearch, filteredCompletedClients.length, filteredUnservedClients.length]);

  const renderClientList = (clientList: Client[], icon: React.ReactNode) => (
    clientList.map(c => (
      <CommandItem
        key={c.id}
        value={c.name}
        onSelect={() => handleClientSelect(c.id)}
      >
        <div className="flex items-center gap-2">
            {icon}
            {c.name}
        </div>
      </CommandItem>
    ))
  );

  const handleDumpsterSelection = (dumpsterId: string) => {
    setSelectedDumpsterIds((prev) =>
      prev.includes(dumpsterId)
        ? prev.filter((id) => id !== dumpsterId)
        : [...prev, dumpsterId]
    );
  };

  const getCombinedDisabledDates = () => {
    if (selectedDumpsterIds.length === 0) return [];
    
    // Find intersections of available dates
    let availableDates: Date[] | null = null;

    selectedDumpsterIds.forEach(id => {
      const dumpster = dumpsters.find(d => d.id === id);
      if (!dumpster) return;

      const dumpsterAvailableDates = getAvailableDatesForDumpster(dumpster);
      
      if (availableDates === null) {
        availableDates = dumpsterAvailableDates;
      } else {
        availableDates = availableDates.filter(date => 
          dumpsterAvailableDates.some(d => isSameDay(d, date))
        );
      }
    });

    // Create disabled ranges from the inverted available dates
    const today = startOfToday();
    const futureLimit = addDays(today, 365);
    const disabled = [];
    let currentDate = today;

    while (currentDate <= futureLimit) {
      if (!availableDates?.some(d => isSameDay(d, currentDate))) {
        disabled.push(new Date(currentDate));
      }
      currentDate = addDays(currentDate, 1);
    }

    return disabled;
  };
  
  const getAvailableDatesForDumpster = (dumpster: DumpsterForForm): Date[] => {
      const today = startOfToday();
      const futureLimit = addDays(today, 365); // Check for the next year
      const available: Date[] = [];
      let currentDate = today;

      while (currentDate <= futureLimit) {
          const isDisabled = dumpster.disabledRanges.some(range => isWithinInterval(currentDate, range));
          if (!isDisabled) {
              available.push(new Date(currentDate));
          }
          currentDate = addDays(currentDate, 1);
      }
      return available;
  };

  const combinedDisabledDates = getCombinedDisabledDates();

  const selectedDumpsters = dumpsters.filter(d => selectedDumpsterIds.includes(d.id));

  return (
    <form action={handleFormAction} className="space-y-6">
      {swapOriginId && <input type="hidden" name="swapOriginId" value={swapOriginId} />}
       <div className="space-y-2">
            <Label htmlFor="dumpsterId">Caçamba(s)</Label>
            <Dialog open={dumpsterSelectOpen} onOpenChange={setDumpsterSelectOpen}>
                <DialogTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={dumpsterSelectOpen}
                        className="w-full justify-between"
                    >
                        <span className="truncate">
                        {selectedDumpsterIds.length > 0
                        ? dumpsters
                            .filter(d => selectedDumpsterIds.includes(d.id))
                            .map(d => d.name)
                            .join(', ')
                        : "Selecione uma ou mais caçambas"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Selecione as Caçambas</DialogTitle>
                </DialogHeader>
                 <div className="max-h-[60vh] overflow-y-auto p-1">
                  {dumpsters.map(d => (
                    <div key={d.id} className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded-md">
                      <Checkbox
                        id={`dumpster-${d.id}`}
                        checked={selectedDumpsterIds.includes(d.id)}
                        onCheckedChange={() => handleDumpsterSelection(d.id)}
                        disabled={d.status === 'Em Manutenção'}
                      />
                      <Label htmlFor={`dumpster-${d.id}`} className="w-full flex justify-between items-center cursor-pointer">
                        <div>
                          <p>{d.name} ({d.size}m³, {d.color})</p>
                          {d.specialStatus && (
                            <p className={cn("text-xs",
                                d.specialStatus.includes('Alugada') ? 'text-destructive' :
                                d.specialStatus.includes('Reservada') ? 'text-blue-600' :
                                d.specialStatus.includes('Encerra hoje') ? 'text-yellow-600' :
                                d.specialStatus.includes('Atraso') ? 'text-red-700 font-bold' :
                                'text-muted-foreground'
                            )}>{d.specialStatus}</p>
                          )}
                        </div>
                      </Label>
                    </div>
                  ))}
                </div>
                 <DialogFooter className="p-6 bg-muted/50 rounded-b-lg">
                    <Button onClick={() => setDumpsterSelectOpen(false)}>Confirmar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          {errors?.dumpsterIds && <p className="text-sm font-medium text-destructive">{errors.dumpsterIds[0]}</p>}
        </div>

        <div className="space-y-2">
            <Label htmlFor="clientId">Cliente</Label>
            <Dialog open={clientSelectOpen} onOpenChange={setClientSelectOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" className="w-full justify-between font-normal">
                       {selectedClientId ? clients.find(c => c.id === selectedClientId)?.name : 'Selecione um cliente'}
                       <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </DialogTrigger>
                <DialogContent className="p-0">
                    <DialogHeader className="p-4 pb-0">
                        <DialogTitle>Selecionar Cliente</DialogTitle>
                    </DialogHeader>
                    <Command>
                         <CommandInput placeholder="Buscar cliente..." value={clientSearch} onValueChange={setClientSearch}/>
                         <CommandList className="max-h-[60vh]">
                            <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                             {filteredNewClients.length > 0 && (
                                <CommandGroup heading="Novos Clientes">
                                    {renderClientList(filteredNewClients, <Star className="h-4 w-4 mr-2" />)}
                                </CommandGroup>
                            )}
                            {filteredActiveClients.length > 0 && (
                                <CommandGroup heading="Em Atendimento">
                                    {renderClientList(filteredActiveClients, <Building className="h-4 w-4 mr-2" />)}
                                </CommandGroup>
                            )}
                            <Accordion type="multiple" className="w-full" value={openAccordionGroups} onValueChange={setOpenAccordionGroups}>
                                {filteredCompletedClients.length > 0 && (
                                    <AccordionItem value="completed">
                                        <AccordionTrigger className="px-2 text-sm font-semibold text-muted-foreground">Concluídos</AccordionTrigger>
                                        <AccordionContent className="p-1">
                                            <CommandGroup>
                                                {renderClientList(filteredCompletedClients, <ShieldCheck className="h-4 w-4 mr-2" />)}
                                            </CommandGroup>
                                        </AccordionContent>
                                    </AccordionItem>
                                )}
                                {filteredUnservedClients.length > 0 && (
                                     <AccordionItem value="unserved">
                                        <AccordionTrigger className="px-2 text-sm font-semibold text-muted-foreground">Não Atendidos</AccordionTrigger>
                                        <AccordionContent className="p-1">
                                            <CommandGroup>
                                                 {renderClientList(filteredUnservedClients, <User className="h-4 w-4 mr-2" />)}
                                            </CommandGroup>
                                        </AccordionContent>
                                    </AccordionItem>
                                )}
                            </Accordion>
                         </CommandList>
                         <CommandSeparator />
                          <CommandGroup>
                             <CommandItem onSelect={() => handleClientSelect('add-new-client')} className="text-primary focus:bg-primary/10 focus:text-primary">
                                <Plus className="mr-2 h-4 w-4" />
                                Novo Cliente
                            </CommandItem>
                         </CommandGroup>
                    </Command>
                </DialogContent>
            </Dialog>
           {errors?.clientId && <p className="text-sm font-medium text-destructive">{errors.clientId[0]}</p>}
        </div>

      <div className="grid grid-cols-2 gap-4">
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
            <Label htmlFor="truckId">Caminhão (Opcional)</Label>
            <Select name="truckId" onValueChange={setSelectedTruckId} value={selectedTruckId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um caminhão para o serviço" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sem-caminhao">Nenhum caminhão</SelectItem>
                {poliguindasteTrucks.map(t => <SelectItem key={t.id} value={t.id} disabled={t.status === 'Em Manutenção'}>{t.name} ({t.plate})</SelectItem>)}
              </SelectContent>
            </Select>
        </div>
      </div>
      
       <div className="p-4 border rounded-md space-y-4 bg-card relative">
        {(account?.bases?.length ?? 0) > 0 && (
            <div className="space-y-2">
                <Label htmlFor="base-select" className="text-muted-foreground">Endereço de Partida</Label>
                <Select onValueChange={handleBaseSelect} defaultValue={account?.bases?.[0].id}>
                    <SelectTrigger id="base-select">
                        <SelectValue placeholder="Selecione uma base de partida" />
                    </SelectTrigger>
                    <SelectContent>
                        {account?.bases?.map(base => (
                            <SelectItem key={base.id} value={base.id}>{base.name} - {base.address}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        )}
        <Accordion type="single" collapsible className="w-full" defaultValue="">
             <AccordionItem value="custom-address" className="border-b-0">
                <div className="flex justify-between items-center w-full">
                  <AccordionTrigger className="text-sm hover:no-underline p-0 justify-start [&>svg]:ml-1 data-[state=closed]:text-muted-foreground flex-grow">
                      <span className="font-normal">{ (account?.bases?.length ?? 0) > 0 ? "Ou digite um endereço de partida personalizado" : "Endereço de Partida" }</span>
                  </AccordionTrigger>
                  <MapDialog onLocationSelect={handleStartLocationSelect} address={startAddress} initialLocation={startLocation} />
                </div>
                <AccordionContent className="pt-4 space-y-2">
                    <AddressInput id="start-address-input" value={startAddress} onInputChange={handleStartAddressChange} onLocationSelect={handleStartLocationSelect} />
                    {errors?.startAddress && (
                        <p className="text-sm font-medium text-destructive mt-2">{errors.startAddress[0]}</p>
                    )}
                </AccordionContent>
             </AccordionItem>
        </Accordion>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="address-input">Endereço de Entrega</Label>
        <AddressInput
            id="address-input"
            value={deliveryAddress}
            onInputChange={handleDeliveryAddressChange}
            onLocationSelect={handleDeliveryLocationSelect}
        />
        {errors?.deliveryAddress && <p className="text-sm font-medium text-destructive">{errors.deliveryAddress[0]}</p>}
      </div>

      {isFetchingInfo && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Spinner size="small" />
          Calculando rota e previsão do tempo...
        </div>
      )}
      
       {(directions || weather || (travelCost !== null && travelCost > 0)) && startLocation && deliveryLocation && !isFetchingInfo && (
          <div className="relative">
             <Alert variant="info" className="flex-grow flex flex-col gap-4">
               <AlertTitle>Informações da Rota e Clima</AlertTitle>
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                {directions && (
                    <>
                    <div className="flex items-center gap-2 text-sm">
                        <Route className="h-5 w-5" />
                        <span className="font-bold">{directions.distance}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-5 w-5" />
                        <span className="font-bold">{directions.duration}</span>
                    </div>
                    </>
                )}
                 {weather && (
                    <div className="text-center">
                    <div className="flex items-center gap-2 text-sm">
                        <WeatherIcon condition={weather.condition} />
                        <span className="font-bold">{weather.tempC}°C</span>
                    </div>
                    </div>
                )}
                 {(travelCost !== null && travelCost > 0) && (
                    <div className="flex items-center gap-2 text-sm">
                        <DollarSign className="h-5 w-5" />
                        <span className="font-bold">{formatCurrencyForDisplay(travelCost)} (ida/volta)</span>
                    </div>
                 )}
                </div>
                 <Button asChild variant="outline" size="sm" className="w-full mt-auto border-primary/50">
                    <Link
                        href={`https://www.google.com/maps/dir/?api=1&origin=${startLocation.lat},${startLocation.lng}&destination=${deliveryLocation.lat},${deliveryLocation.lng}`}
                        target="_blank"
                        className="flex items-center gap-2"
                    >
                        <MapIcon className="h-4 w-4" />
                        <span>Ver Trajeto no Mapa</span>
                    </Link>
                </Button>
            </Alert>
          </div>
        )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Data de Entrega</Label>
          <Popover open={isRentalDateOpen} onOpenChange={setIsRentalDateOpen}>
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
                onSelect={(date) => {
                    if (date) {
                        setRentalDate(date);
                        setReturnDate(addDays(date, 2));
                    } else {
                        setRentalDate(undefined);
                        setReturnDate(undefined);
                    }
                    setIsRentalDateOpen(false);
                }}
                disabled={combinedDisabledDates}
                initialFocus
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
          {errors?.rentalDate && <p className="text-sm font-medium text-destructive">{errors.rentalDate[0]}</p>}
        </div>
        <div className="space-y-2">
          <Label>Data de Retirada (Prevista)</Label>
          <Popover open={isReturnDateOpen} onOpenChange={setIsReturnDateOpen}>
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
                onSelect={(date) => {
                    setReturnDate(date);
                    setIsReturnDateOpen(false);
                }}
                disabled={(date) => {
                    if (!rentalDate || isBeforeDate(date, rentalDate)) {
                        return true;
                    }
                    // Check against combined disabled dates
                    if(combinedDisabledDates.some(disabledDate => isSameDay(date, disabledDate))) {
                        return true;
                    }
                    return false;
                }}
                initialFocus
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
           {errors?.returnDate && <p className="text-sm font-medium text-destructive">{errors.returnDate[0]}</p>}
        </div>
      </div>
      
       <div className="pt-2 space-y-2">
       </div>
      
      <Accordion type="single" collapsible defaultValue="per-day" className="w-full" onValueChange={handleAccordionChange}>
        <AccordionItem value="per-day">
          <AccordionTrigger>Cobrar por Diária</AccordionTrigger>
          <AccordionContent>
             <div className="p-4 border rounded-md space-y-4 bg-card">
              <div className="space-y-2">
                {(rentalPrices && rentalPrices.length > 0) ? (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Select onValueChange={handlePriceSelection} value={priceId} disabled={billingType !== 'perDay'}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um preço" />
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
                      name="value_display"
                      value={displayValue}
                      onChange={handleValueChange}
                      placeholder="R$ 0,00"
                      required={billingType === 'perDay'}
                      className="sm:w-1/3 text-right"
                      disabled={billingType !== 'perDay'}
                    />
                  </div>
                ) : (
                  <Input
                    id="value_display"
                    name="value_display"
                    value={displayValue}
                    onChange={handleValueChange}
                    placeholder="R$ 0,00"
                    required={billingType === 'perDay'}
                    className="text-right"
                    disabled={billingType !== 'perDay'}
                  />
                )}
              </div>
              {errors?.value && <p className="text-sm font-medium text-destructive">{errors.value[0]}</p>}
            </div>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="lump-sum">
          <AccordionTrigger>Cobrar por Empreitada (Valor Fechado)</AccordionTrigger>
          <AccordionContent>
            <div className="p-4 border rounded-md space-y-4 bg-card">
                <Label htmlFor="lumpSumValue">Valor Total do Serviço</Label>
                 <Input
                    id="lumpSumValue"
                    name="lumpSumValue_display"
                    value={displayLumpSumValue}
                    onChange={handleLumpSumValueChange}
                    placeholder="R$ 0,00"
                    required={billingType === 'lumpSum'}
                    className="text-right"
                    disabled={billingType !== 'lumpSum'}
                />
                 {errors?.lumpSumValue && <p className="text-sm font-medium text-destructive">{errors.lumpSumValue[0]}</p>}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      
       <div className="p-4 border rounded-md space-y-4 bg-card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-destructive" />
                <span className="font-medium">Custo Total da Operação:</span>
                <span className="font-bold text-destructive">{formatCurrencyForDisplay(totalOperationCost)}</span>
            </div>
             <CostsDialog 
                costs={additionalCosts} 
                onSave={setAdditionalCosts} 
              >
                <Button type="button" variant="outline">Adicionar Custos</Button>
            </CostsDialog>
        </div>
        {(totalRentalValue > 0 || totalOperationCost > 0) && (
            <>
            <Separator />
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-sm pt-2 gap-2 sm:gap-4">
                <div className="flex items-center gap-2">
                    {profit >= 0 ? 
                        <TrendingUp className="h-4 w-4 text-green-600" /> : 
                        <TrendingDown className="h-4 w-4 text-red-600" />
                    }
                    <span className="font-medium">Lucro Previsto:</span>
                    <span className={cn(
                        "font-bold",
                        profit >= 0 ? "text-green-600" : "text-red-600"
                    )}>
                        {formatCurrencyForDisplay(profit)}
                    </span>
                </div>
            </div>
            </>
        )}
      </div>

       <div className="space-y-2">
        <Label htmlFor="observations">Observações</Label>
        <Textarea id="observations" name="observations" defaultValue={prefillData?.observations || ''} placeholder="Ex: Deixar caçamba na calçada, portão azul." />
        {errors?.observations && <p className="text-sm font-medium text-destructive">{errors.observations[0]}</p>}
      </div>
      
       {canUseAttachments && accountId && (
        <div className="p-4 border rounded-md space-y-2 bg-card">
            <AttachmentsUploader 
                accountId={accountId}
                attachments={attachments}
                onAttachmentUploaded={handleAttachmentUploaded}
                onAttachmentDeleted={handleRemoveAttachment}
                uploadPath={`accounts/${accountId}/rentals/attachments`}
            />
        </div>
      )}

      <div className="flex flex-col sm:flex-row-reverse gap-2 pt-4">
        <SubmitButton isPending={isPending} />
        <Button asChild variant="outline" size="lg">
            <Link href="/os">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
