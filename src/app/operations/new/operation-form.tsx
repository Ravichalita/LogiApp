
'use client';

import { useEffect, useState, useTransition, useRef, useMemo } from 'react';
import { createOperationAction } from '@/lib/actions';
import type { Client, Dumpster, Location, UserAccount, RentalPrice, Attachment, Account, Base, AdditionalCost, Truck, PopulatedOperation, OperationType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CalendarIcon, User, AlertCircle, MapPin, Warehouse, Route, Clock, Sun, CloudRain, Cloudy, Snowflake, DollarSign, Map as MapIcon, TrendingDown, TrendingUp, Plus, ChevronsUpDown, Check, ListFilter, Star, Building, ShieldCheck, Navigation } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO, isBefore as isBeforeDate, startOfToday, addDays, isSameDay, differenceInCalendarDays, set, addHours, isWithinInterval, endOfDay, subDays } from 'date-fns';
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
import { OperationTypeDialog } from './operation-type-dialog';
import { ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { Dialog, DialogTrigger, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { RecurrenceSelector, RecurrenceData } from '@/components/recurrence-selector';


const initialState = {
  errors: {},
  message: '',
};

interface OperationFormProps {
  clients: Client[];
  classifiedClients: {
    newClients: Client[];
    activeClients: Client[];
    completedClients: Client[];
    unservedClients: Client[];
  };
  team: UserAccount[];
  trucks: Truck[];
  operations: PopulatedOperation[];
  operationTypes: OperationType[];
  account: Account | null;
  prefillClientId?: string;
}

const formatCurrencyForInput = (valueInCents: string): string => {
  if (!valueInCents) return '0,00';
  const numericValue = parseInt(valueInCents.replace(/\D/g, ''), 10) || 0;
  const reais = Math.floor(numericValue / 100);
  const centavos = (numericValue % 100).toString().padStart(2, '0');
  return `${reais.toLocaleString('pt-BR')},${centavos}`;
};

const formatCurrency = (value: number | undefined | null) => {
  if (value === undefined || value === null) {
    return "R$ 0,00";
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

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

function SubmitButton({ isPending }: { isPending: boolean }) {
  return (
    <Button type="submit" disabled={isPending} size="lg">
      {isPending ? <Spinner size="small" /> : 'Salvar OS'}
    </Button>
  );
}

export function OperationForm({ clients, classifiedClients, team, trucks, operations, operationTypes, account, prefillClientId }: OperationFormProps) {
  const { user, accountId, userAccount, isSuperAdmin } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<any>({});
  const { toast } = useToast();
  const router = useRouter();

  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [startTime, setStartTime] = useState<string>(format(new Date(), 'HH:mm'));
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [endTime, setEndTime] = useState<string>('');

  const defaultBase = account?.bases?.[0];
  const [selectedBaseId, setSelectedBaseId] = useState<string | undefined>(defaultBase?.id);
  const [startAddress, setStartAddress] = useState(defaultBase?.address || '');
  const [startLocation, setStartLocation] = useState<Omit<Location, 'address'> | null>(
    defaultBase?.latitude && defaultBase.longitude ? { lat: defaultBase.latitude, lng: defaultBase.longitude } : null
  );

  const [destinationAddress, setDestinationAddress] = useState('');
  const [destinationLocation, setDestinationLocation] = useState<Omit<Location, 'address'> | null>(null);
  const [destinationMapsLink, setDestinationMapsLink] = useState('');
  const [observations, setObservations] = useState<string>('');
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>(prefillClientId);
  const [selectedTruckId, setSelectedTruckId] = useState<string | undefined>();

  const [selectedOperationTypeIds, setSelectedOperationTypeIds] = useState<string[]>([]);
  const [baseValue, setBaseValue] = useState(0);
  const [additionalCosts, setAdditionalCosts] = useState<AdditionalCost[]>([]);

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [scheduleConflict, setScheduleConflict] = useState<string | null>(null);

  const [directions, setDirections] = useState<{ distanceMeters: number; distance: string, duration: string } | null>(null);
  const [weather, setWeather] = useState<{ condition: string; tempC: number } | null>(null);
  const [travelCost, setTravelCost] = useState<number | null>(null);
  const [isFetchingInfo, setIsFetchingInfo] = useState(false);
  const [clientSelectOpen, setClientSelectOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [openAccordionGroups, setOpenAccordionGroups] = useState<string[]>([]);

  const [recurrenceData, setRecurrenceData] = useState<RecurrenceData>({
    enabled: false,
    frequency: 'weekly',
    daysOfWeek: [],
    time: '08:00',
    billingType: 'perService',
    monthlyValue: 0,
  });

  const [isStartDateOpen, setIsStartDateOpen] = useState(false);
  const [isEndDateOpen, setIsEndDateOpen] = useState(false);
  const totalOperationCost = (travelCost || 0) + additionalCosts.reduce((acc, cost) => acc + cost.value, 0);
  const profit = baseValue - totalOperationCost;
  const canUseAttachments = isSuperAdmin || userAccount?.permissions?.canUseAttachments;

  // Address suggestions toggle with localStorage persistence
  const [enableAddressSuggestions, setEnableAddressSuggestions] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('addressSuggestionsEnabled') === 'true';
    }
    return false;
  });

  const handleSuggestionsToggle = (checked: boolean) => {
    setEnableAddressSuggestions(checked);
    if (typeof window !== 'undefined') {
      localStorage.setItem('addressSuggestionsEnabled', String(checked));
    }
  };


  useEffect(() => {
    if (!startLocation && startAddress) {
      if (userAccount?.permissions?.canUsePaidGoogleAPIs === false) return;
      geocodeAddress(startAddress).then(location => {
        if (location) {
          setStartLocation({ lat: location.lat, lng: location.lng });
        }
      });
    }
  }, [startAddress, startLocation, userAccount]);

  useEffect(() => {
    if (!destinationLocation && destinationAddress) {
      if (userAccount?.permissions?.canUsePaidGoogleAPIs === false) return;
      geocodeAddress(destinationAddress).then(location => {
        if (location) {
          setDestinationLocation({ lat: location.lat, lng: location.lng });
        }
      });
    }
  }, [destinationAddress, destinationLocation, userAccount]);

  // Manual fetch route info function (no longer automatic)
  const fetchRouteInfo = async () => {
    if (!startLocation || !destinationLocation || !startDate) {
      toast({
        title: "Dados Incompletos",
        description: "Preencha os endereços e a data antes de calcular a rota.",
        variant: "destructive"
      });
      return;
    }

    setIsFetchingInfo(true);
    setDirections(null);
    setWeather(null);
    setTravelCost(null);

    if (userAccount?.permissions?.canUsePaidGoogleAPIs === false) {
      toast({
        title: "Recurso Indisponível",
        description: "Seu plano não inclui o cálculo de rotas e clima.",
        variant: "destructive"
      });
      setIsFetchingInfo(false);
      return;
    }

    try {
      const [directionsResult, weatherResult] = await Promise.all([
        getDirectionsAction(startLocation, destinationLocation),
        getWeatherForecastAction(destinationLocation, startDate),
      ]);

      if (directionsResult) {
        setDirections(directionsResult);
        const truck = trucks.find(t => t.id === selectedTruckId);
        const truckType = account?.truckTypes.find(t => t.name === truck?.type);

        if (truckType) {
          let costConfig = account?.operationalCosts.find(c => c.baseId === selectedBaseId && c.truckTypeId === truckType.id);
          if (!costConfig) {
            costConfig = account?.operationalCosts.find(c => c.truckTypeId === truckType.id);
          }

          const costPerKm = costConfig?.value || 0;

          if (costPerKm > 0 && directionsResult.distanceMeters) {
            setTravelCost((directionsResult.distanceMeters / 1000) * 2 * costPerKm);
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
      console.error("Error fetching route or weather info:", error);
      toast({
        title: "Erro",
        description: "Falha ao calcular rota e clima.",
        variant: "destructive"
      });
    } finally {
      setIsFetchingInfo(false);
    }
  };


  useEffect(() => {
    if (startDate && startTime) {
      const [hours, minutes] = startTime.split(':').map(Number);
      const startDateTime = set(startDate, { hours, minutes });
      const endDateTime = addHours(startDateTime, 1);

      setEndDate(endDateTime);
      setEndTime(format(endDateTime, 'HH:mm'));
    }
  }, [startDate, startTime]);

  useEffect(() => {
    if (selectedClientId) {
      const client = clients.find(c => c.id === selectedClientId);
      if (client) {
        setDestinationAddress(client.address);
        setDestinationMapsLink(client.googleMapsLink || '');
        setObservations(client.observations || '');
        if (client.latitude && client.longitude) {
          setDestinationLocation({ lat: client.latitude, lng: client.longitude });
        } else {
          setDestinationLocation(null);
          if (userAccount?.permissions?.canUsePaidGoogleAPIs !== false) {
            geocodeAddress(client.address).then(location => {
              if (location) setDestinationLocation({ lat: location.lat, lng: location.lng });
            });
          }
        }
      }
    } else {
      setDestinationAddress('');
      setDestinationLocation(null);
      setDestinationMapsLink('');
      setObservations('');
    }
  }, [selectedClientId, clients]);

  useEffect(() => {
    const newBaseValue = selectedOperationTypeIds.reduce((total, id) => {
      const selectedType = operationTypes.find(t => t.id === id);
      return total + (selectedType?.value || 0);
    }, 0);
    setBaseValue(newBaseValue);
  }, [selectedOperationTypeIds, operationTypes]);

  useEffect(() => {
    if (!selectedTruckId || !startDate || !startTime || !endDate || !endTime) {
      setScheduleConflict(null);
      return;
    }

    const combineDateTime = (date: Date, time: string): Date => {
      const [hours, minutes] = time.split(':').map(Number);
      return set(date, { hours, minutes });
    };

    const currentStart = combineDateTime(startDate, startTime);
    const currentEnd = combineDateTime(endDate, endTime);

    const conflictingOp = operations.find(op => {
      if (op.truckId !== selectedTruckId || !op.startDate || !op.endDate) {
        return false;
      }
      const opStart = parseISO(op.startDate);
      const opEnd = parseISO(op.endDate);

      return currentStart < opEnd && currentEnd > opStart;
    });

    if (conflictingOp) {
      setScheduleConflict(
        `Este caminhão já está em uma operação de ${format(
          parseISO(conflictingOp.startDate!),
          "HH:mm"
        )} até ${format(parseISO(conflictingOp.endDate!), "HH:mm")} neste período.`
      );
    } else {
      setScheduleConflict(null);
    }
  }, [selectedTruckId, startDate, startTime, endDate, endTime, operations]);

  const handleBaseSelect = (baseId: string) => {
    setSelectedBaseId(baseId);
    const selectedBase = account?.bases?.find(b => b.id === baseId);
    if (selectedBase) {
      setStartAddress(selectedBase.address);
      if (selectedBase.latitude && selectedBase.longitude) {
        setStartLocation({ lat: selectedBase.latitude, lng: selectedBase.longitude });
      } else {
        setStartLocation(null);
        if (userAccount?.permissions?.canUsePaidGoogleAPIs !== false) {
          geocodeAddress(selectedBase.address).then(location => {
            if (location) {
              setStartLocation({ lat: location.lat, lng: location.lng });
            }
          });
        }
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

  const handleDestinationLocationSelect = (selectedLocation: Location) => {
    setDestinationLocation({ lat: selectedLocation.lat, lng: selectedLocation.lng });
    setDestinationAddress(selectedLocation.address);
  };

  const handleDestinationAddressChange = (newAddress: string) => {
    setDestinationAddress(newAddress);
    setDestinationLocation(null);
  }

  const handleBaseValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    const cents = parseInt(rawValue, 10) || 0;
    setBaseValue(cents / 100);
  }

  const handleTruckChange = (truckId: string) => {
    setSelectedTruckId(truckId);
  }

  const handleAttachmentUploaded = (newAttachment: Attachment) => {
    setAttachments(prev => [...prev, newAttachment]);
  };

  const handleRemoveAttachment = (attachmentToRemove: Attachment) => {
    setAttachments(prev => prev.filter(att => att.url !== attachmentToRemove.url));
  };

  const handleClientSelect = (clientId: string) => {
    if (clientId === 'add-new-client') {
      router.push('/clients/new');
      return;
    }
    setSelectedClientId(clientId);
    setClientSelectOpen(false);
  }

  useEffect(() => {
    if (selectedClientId && userAccount?.permissions?.canUsePaidGoogleAPIs === false) {
      // Just load client info but skip geocoding logic handled in other useEffects via the permission check
    }
  }, [selectedClientId, userAccount]);

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

  const handleFormAction = (formData: FormData) => {
    startTransition(async () => {
      if (!accountId || !user) {
        toast({ title: "Erro", description: "Você precisa estar logado.", variant: "destructive" });
        return;
      }

      const combineDateTime = (date: Date | undefined, time: string): string | undefined => {
        if (!date || !time) return undefined;
        const [hours, minutes] = time.split(':').map(Number);
        return set(date, { hours, minutes }).toISOString();
      };

      const finalStartDate = combineDateTime(startDate, startTime);
      const finalEndDate = combineDateTime(endDate, endTime);

      if (selectedClientId) formData.set('clientId', selectedClientId);
      if (finalStartDate) formData.set('startDate', finalStartDate);
      if (finalEndDate) formData.set('endDate', finalEndDate);

      formData.set('typeIds', JSON.stringify(selectedOperationTypeIds));

      formData.set('startAddress', startAddress);
      if (startLocation) {
        formData.set('startLatitude', String(startLocation.lat));
        formData.set('startLongitude', String(startLocation.lng));
      }

      formData.set('destinationAddress', destinationAddress);
      if (destinationLocation) {
        formData.set('destinationLatitude', String(destinationLocation.lat));
        formData.set('destinationLongitude', String(destinationLocation.lng));
      }
      if (destinationMapsLink) {
        formData.set('destinationGoogleMapsLink', destinationMapsLink);
      }

      formData.set('value', String(baseValue));
      formData.set('additionalCosts', JSON.stringify(additionalCosts));

      formData.set('attachments', JSON.stringify(attachments));

      if (travelCost) {
        formData.set('travelCost', String(travelCost));
      }

      if (recurrenceData.enabled) {
        formData.set('recurrence', JSON.stringify(recurrenceData));
      }

      const boundAction = createOperationAction.bind(null, accountId, user.uid);
      const result = await boundAction(null, formData);

      if ((result as any)?.errors) {
        setErrors((result as any).errors);
        const errorMessages = Object.values(result.errors).flat().join(' ');
        toast({
          title: "Erro de Validação",
          description: errorMessages,
          variant: "destructive"
        })
      }
      if (result?.message && !(result as any).errors) {
        const description = (result as any).error || result.message;
        toast({ title: "Erro", description: description, variant: "destructive" });
      }
    });
  };

  return (
    <form action={handleFormAction} className="space-y-6">

      <div className="p-4 border rounded-md space-y-4 bg-card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="type" className="text-muted-foreground">Tipo de Operação</Label>
            <OperationTypeDialog
              operationTypes={operationTypes}
              selectedTypeIds={selectedOperationTypeIds}
              onSave={setSelectedOperationTypeIds}
            >
              <Button type="button" variant="outline" className="w-full justify-between">
                {selectedOperationTypeIds.length > 0
                  ? `${selectedOperationTypeIds.length} tipo(s) selecionado(s)`
                  : "Selecione o(s) tipo(s)"}
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </OperationTypeDialog>
            {errors?.typeIds && <p className="text-sm font-medium text-destructive">{errors.typeIds[0]}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientId" className="text-muted-foreground">Cliente</Label>
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
                  <CommandInput placeholder="Buscar cliente..." value={clientSearch} onValueChange={setClientSearch} />
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
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="driverId" className="text-muted-foreground">Responsável</Label>
            <Select name="driverId" required>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um responsável" />
              </SelectTrigger>
              <SelectContent>
                {team.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors?.driverId && <p className="text-sm font-medium text-destructive">{errors.driverId[0]}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="truckId" className="text-muted-foreground">Caminhão</Label>
            <Select name="truckId" onValueChange={handleTruckChange} required>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um caminhão" />
              </SelectTrigger>
              <SelectContent>
                {trucks.filter(t => !t.type?.toLowerCase().includes('poliguindaste')).map(t => <SelectItem key={t.id} value={t.id}>{t.name} ({t.plate})</SelectItem>)}
              </SelectContent>
            </Select>
            {errors?.truckId && <p className="text-sm font-medium text-destructive">{errors.truckId[0]}</p>}
          </div>
        </div>
      </div>

      <div className="p-4 border rounded-md space-y-4 bg-card">
        <div className="space-y-2">
          <Label className="text-muted-foreground" >Início da Operação</Label>
          <div className="flex items-center gap-2">
            <Popover open={isStartDateOpen} onOpenChange={setIsStartDateOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                  disabled={!selectedTruckId}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "PPP", { locale: ptBR }) : <span>Escolha uma data</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => {
                    setStartDate(date);
                    setIsStartDateOpen(false);
                  }}
                  initialFocus
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-auto" disabled={!selectedTruckId} />
          </div>
          {!selectedTruckId && <p className="text-xs text-muted-foreground">Selecione um caminhão para habilitar a data.</p>}
          {errors?.startDate && <p className="text-sm font-medium text-destructive">{errors.startDate[0]}</p>}
        </div>

        <Accordion type="single" collapsible className="w-full" defaultValue="">
          <AccordionItem value="end-datetime" className="border-b-0">
            <AccordionTrigger className="text-sm text-primary hover:no-underline p-0 justify-start [&>svg]:ml-1 data-[state=closed]:text-muted-foreground">
              <span className="font-normal">Editar termino da operação</span>
            </AccordionTrigger>
            <AccordionContent className="pt-4 mt-2">
              <div className="space-y-2">
                <Label>Término (Previsão)</Label>
                <div className="flex items-center gap-2">
                  <Popover open={isEndDateOpen} onOpenChange={setIsEndDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "PPP", { locale: ptBR }) : <span>Escolha uma data</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={(date) => {
                          setEndDate(date);
                          setIsEndDateOpen(false);
                        }}
                        initialFocus
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                  <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-auto" />
                </div>
                {errors?.endDate && <p className="text-sm font-medium text-destructive">{errors.endDate[0]}</p>}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        {scheduleConflict && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Conflito de Agendamento</AlertTitle>
            <AlertDescription>{scheduleConflict}</AlertDescription>
          </Alert>
        )}
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
                <span className="font-normal">{(account?.bases?.length ?? 0) > 0 ? "Ou digite um endereço de partida personalizado" : "Endereço de Partida"}</span>
              </AccordionTrigger>
              <MapDialog onLocationSelect={handleStartLocationSelect} address={startAddress} initialLocation={startLocation} />
            </div>
            <AccordionContent className="pt-4 space-y-2">
              <AddressInput
                id="start-address-input"
                value={startAddress}
                onInputChange={handleStartAddressChange}
                onLocationSelect={handleStartLocationSelect}
                enableSuggestions={enableAddressSuggestions}
                provider={account?.geocodingProvider || 'locationiq'}
                disabled={userAccount?.permissions?.canUseGeocoding === false}
              />
              {errors?.startAddress && (
                <p className="text-sm font-medium text-destructive mt-2">{errors.startAddress[0]}</p>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Separator />
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="destination-address-input" className="text-muted-foreground">Endereço de Destino</Label>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="link" size="sm" type="button" className="text-xs h-auto p-0">Inserir link do Google Maps</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Link do Google Maps</DialogTitle>
                  <DialogDescription>
                    Cole o link de compartilhamento do Google Maps para o endereço de destino. Isso garantirá a localização mais precisa.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="destination-maps-link-input">Link</Label>
                  <Input
                    id="destination-maps-link-input"
                    value={destinationMapsLink}
                    onChange={(e) => setDestinationMapsLink(e.target.value)}
                    placeholder="https://maps.app.goo.gl/..."
                  />
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button">Salvar</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <AddressInput
            id="destination-address-input"
            value={destinationAddress}
            onInputChange={handleDestinationAddressChange}
            onLocationSelect={handleDestinationLocationSelect}
            enableSuggestions={enableAddressSuggestions}
            provider={account?.geocodingProvider || 'locationiq'}
            disabled={userAccount?.permissions?.canUseGeocoding === false}
          />
          {userAccount?.permissions?.canUsePaidGoogleAPIs !== false && (
            <div className="flex items-center gap-2 mt-2">
              <Checkbox
                id="enable-suggestions-op"
                checked={enableAddressSuggestions}
                onCheckedChange={handleSuggestionsToggle}
              />
              <Label htmlFor="enable-suggestions-op" className="text-sm font-normal text-muted-foreground cursor-pointer">
                Sugestões de endereço
              </Label>
            </div>
          )}
          {errors?.destinationAddress && <p className="text-sm font-medium text-destructive">{errors.destinationAddress[0]}</p>}
        </div>
      </div>

      {userAccount?.permissions?.canUsePaidGoogleAPIs !== false && (
        <Button
          type="button"
          variant="outline"
          onClick={fetchRouteInfo}
          disabled={isFetchingInfo || !startLocation || !destinationLocation}
          className="w-full"
        >
          {isFetchingInfo ? (
            <><Spinner size="small" className="mr-2" /> Calculando...</>
          ) : (
            <><Navigation className="mr-2 h-4 w-4" /> Calcular Rota e Previsão do Tempo</>
          )}
        </Button>
      )}

      {(directions || weather || (travelCost !== null && travelCost > 0)) && startLocation && destinationLocation && !isFetchingInfo && (
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
                  <span className="font-bold">{formatCurrency(travelCost)} (ida/volta)</span>
                </div>
              )}
            </div>
            <Button asChild variant="outline" size="sm" className="w-full mt-auto border-primary/50">
              <Link
                href={`https://www.google.com/maps/dir/?api=1&origin=${startLocation.lat},${startLocation.lng}&destination=${destinationLocation.lat},${destinationLocation.lng}`}
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

      <div className="p-4 border rounded-md space-y-4 bg-card">
        <div className="grid grid-cols-2 gap-4 items-end">
          <div className="grid gap-2">
            <Label className="text-muted-foreground">Custos Adicionais</Label>
            <CostsDialog
              costs={additionalCosts}
              onSave={setAdditionalCosts}
            >
              <Button type="button" variant="outline" className="w-full">Adicionar Custos</Button>
            </CostsDialog>
          </div>
          {recurrenceData.billingType === 'monthly' ? (
            <div className="grid gap-2">
              <Label htmlFor="monthlyValue" className="text-muted-foreground">Valor Mensal</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                <Input
                  id="monthlyValue"
                  name="monthlyValue_display"
                  value={formatCurrencyForInput((recurrenceData.monthlyValue || 0).toString())}
                  onChange={(e) => {
                    const rawValue = e.target.value.replace(/\D/g, '');
                    const cents = parseInt(rawValue, 10) || 0;
                    setRecurrenceData(prev => ({ ...prev, monthlyValue: cents }));
                  }}
                  placeholder="0,00"
                  className="pl-8 text-right font-bold"
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="value" className="text-muted-foreground">Valor do Serviço</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                <Input
                  id="value"
                  name="value_display"
                  value={formatCurrencyForInput((baseValue * 100).toString())}
                  onChange={handleBaseValueChange}
                  placeholder="0,00"
                  className="pl-8 text-right font-bold"
                />
              </div>
            </div>
          )}
        </div>
        {additionalCosts.length > 0 && (
          <div className="pt-2 space-y-1">
            <Separator />
            <h4 className="text-xs font-semibold text-muted-foreground pt-3">CUSTOS ADICIONAIS:</h4>
            <ul className="text-sm">
              {additionalCosts.map(cost => (
                <li key={cost.id} className="flex justify-between">
                  <span>{cost.name}</span>
                  <span>{formatCurrency(cost.value)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(totalOperationCost > 0 || baseValue > 0) && (
          <>
            <Separator />
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-sm pt-2 gap-2 sm:gap-4">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-destructive" />
                <span className="font-medium">Custo Total da Operação:</span>
                <span className="font-bold text-destructive">{formatCurrency(totalOperationCost)}</span>
              </div>
              <div className="flex items-center gap-2">
                {profit >= 0 ?
                  <TrendingUp className="h-4 w-4 text-green-600" /> :
                  <TrendingDown className="h-4 w-4 text-red-600" />
                }
                <span className="font-medium">Lucro:</span>
                <span className={cn(
                  "font-bold",
                  profit >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {formatCurrency(profit)}
                </span>
              </div>
            </div>
          </>
        )}
        {errors?.value && <p className="text-sm font-medium text-destructive">{errors.value[0]}</p>}
      </div>

      {canUseAttachments && accountId && (
        <div className="p-4 border rounded-md space-y-2 bg-card">
          <AttachmentsUploader
            accountId={accountId}
            attachments={attachments}
            onAttachmentUploaded={handleAttachmentUploaded}
            onAttachmentDeleted={handleRemoveAttachment}
            uploadPath={`accounts/${accountId}/operations/attachments`}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="observations">Observações</Label>
        <Textarea
          id="observations"
          name="observations"
          value={observations}
          onChange={(e) => setObservations(e.target.value)}
          placeholder="Ex: Material a ser coletado, informações de contato no local, etc."
        />
      </div>

      <RecurrenceSelector
        value={recurrenceData}
        onChange={setRecurrenceData}
      />

      <div className="flex flex-col sm:flex-row-reverse gap-2 pt-4">
        <SubmitButton isPending={isPending} />
        <Button asChild variant="outline" size="lg">
          <Link href="/os">Cancelar</Link>
        </Button>
      </div >
    </form >
  );
}
