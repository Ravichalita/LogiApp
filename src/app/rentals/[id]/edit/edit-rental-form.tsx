
'use client';

import { useEffect, useState, useTransition, useMemo } from 'react';
import { updateRentalAction } from '@/lib/actions';
import type { Client, PopulatedRental, Location, UserAccount, RentalPrice, Attachment, Account, AdditionalCost, Truck } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { RecurrenceSelector, RecurrenceData } from '@/components/recurrence-selector';
import { getRecurrenceProfileById } from '@/lib/data-server-actions';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CalendarIcon, User, AlertCircle, MapPin, Warehouse, Route, Clock, Sun, CloudRain, Cloudy, Snowflake, DollarSign, Map as MapIcon, TrendingDown, TrendingUp } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format, isBefore as isBeforeDate, parseISO, startOfToday, addDays, isSameDay, differenceInCalendarDays, set } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/context/auth-context';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { AddressInput } from '@/components/address-input';
import { AttachmentsUploader } from '@/components/attachments-uploader';
import { useRouter } from 'next/navigation';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { geocodeAddress, getDirectionsAction, getWeatherForecastAction } from '@/lib/data-server-actions';
import { MapDialog } from '@/components/map-dialog';
import { CostsDialog } from '@/app/operations/new/costs-dialog';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogTrigger, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

interface EditRentalFormProps {
  rental: PopulatedRental;
  clients: Client[];
  team: UserAccount[];
  trucks: Truck[];
  account: Account;
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


export function EditRentalForm({ rental, clients, team, trucks, account }: EditRentalFormProps) {
  const { accountId, userAccount, isSuperAdmin } = useAuth();
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();
  
  const [assignedToId, setAssignedToId] = useState<string | undefined>(rental.assignedTo);
  const [selectedTruckId, setSelectedTruckId] = useState<string | undefined>(rental.truckId);
  const [deliveryAddress, setDeliveryAddress] = useState<string>(rental.deliveryAddress);
  const [deliveryMapsLink, setDeliveryMapsLink] = useState(rental.deliveryGoogleMapsLink || '');
  const [rentalDate, setRentalDate] = useState<Date | undefined>(parseISO(rental.rentalDate));
  const [rentalTime, setRentalTime] = useState<string>(format(parseISO(rental.rentalDate), 'HH:mm'));
  const [returnDate, setReturnDate] = useState<Date | undefined>(parseISO(rental.returnDate));
  const [returnTime, setReturnTime] = useState<string>(format(parseISO(rental.returnDate), 'HH:mm'));
  const [deliveryLocation, setDeliveryLocation] = useState<Omit<Location, 'address'> | null>(
    rental.latitude && rental.longitude ? { lat: rental.latitude, lng: rental.longitude } : null
  );

  const selectedBase = account?.bases?.find(b => b.address === rental.startAddress);
  const [selectedBaseId, setSelectedBaseId] = useState<string | undefined>(selectedBase?.id);
  const [startAddress, setStartAddress] = useState(rental.startAddress || '');
  const [startLocation, setStartLocation] = useState<Omit<Location, 'address'> | null>(
    rental.startLatitude && rental.startLongitude
      ? { lat: rental.startLatitude, lng: rental.startLongitude }
      : null
  );
  
  const [errors, setErrors] = useState<any>({});
  const [value, setValue] = useState(rental.value);
  const [lumpSumValue, setLumpSumValue] = useState(rental.lumpSumValue || 0);
  const [billingType, setBillingType] = useState<'perDay' | 'lumpSum'>(rental.billingType || 'perDay');

  const [displayValue, setDisplayValue] = useState(formatCurrencyForInput((rental.value * 100).toString()));
  const [displayLumpSumValue, setDisplayLumpSumValue] = useState(formatCurrencyForInput(((rental.lumpSumValue || 0) * 100).toString()));
  
  const [priceId, setPriceId] = useState<string | undefined>();
  const [attachments, setAttachments] = useState<Attachment[]>(rental.attachments || []);
  const [additionalCosts, setAdditionalCosts] = useState<AdditionalCost[]>(rental.additionalCosts || []);
  
  const [directions, setDirections] = useState<{ distanceMeters: number, durationSeconds: number, distance: string, duration: string } | null>(null);
  const [weather, setWeather] = useState<{ condition: string; tempC: number } | null>(null);
  const [travelCost, setTravelCost] = useState<number | null>(null);
  const [isFetchingInfo, setIsFetchingInfo] = useState(false);

  const [recurrenceData, setRecurrenceData] = useState<RecurrenceData>({
    enabled: !!rental.recurrenceProfileId,
    frequency: 'weekly',
    daysOfWeek: [],
    time: '08:00',
    billingType: 'perService',
  });

  const canUseAttachments = isSuperAdmin || userAccount?.permissions?.canUseAttachments;

  const rentalDays = returnDate && rentalDate ? differenceInCalendarDays(returnDate, rentalDate) + 1 : 0;
  const totalRentalValue = billingType === 'lumpSum' ? lumpSumValue : value * rentalDays;
  const totalOperationCost = (travelCost || 0) + additionalCosts.reduce((acc, cost) => acc + cost.value, 0);
  const profit = totalRentalValue - totalOperationCost;

  const poliguindasteTrucks = trucks.filter(t => t.type?.toLowerCase().includes('poliguindaste'));

  useEffect(() => {
    if (rental.recurrenceProfileId && accountId) {
        getRecurrenceProfileById(accountId, rental.recurrenceProfileId).then(profile => {
            if (profile) {
                setRecurrenceData({
                    enabled: true,
                    frequency: profile.frequency,
                    daysOfWeek: profile.daysOfWeek,
                    time: profile.time,
                    endDate: profile.endDate ? parseISO(profile.endDate) : undefined,
                    billingType: profile.billingType,
                    monthlyValue: profile.monthlyValue,
                });
            }
        });
    }
  }, [rental.recurrenceProfileId, accountId]);

  useEffect(() => {
    if (poliguindasteTrucks.length === 1 && !selectedTruckId) {
      setSelectedTruckId(poliguindasteTrucks[0].id);
    }
  }, [poliguindasteTrucks, selectedTruckId]);

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
                // Fallback: If no specific base config, find any config for this truck type.
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
        if (!accountId) {
            toast({ title: "Erro", description: "Você precisa estar logado.", variant: "destructive" });
            return;
        }

        const combineDateTime = (date: Date | undefined, time: string): string | undefined => {
            if (!date || !time) return undefined;
            const [hours, minutes] = time.split(':').map(Number);
            return set(date, { hours, minutes }).toISOString();
        };

        const finalRentalDate = combineDateTime(rentalDate, rentalTime);
        const finalReturnDate = combineDateTime(returnDate, returnTime);
        
        formData.set('id', rental.id);
        if (selectedTruckId) formData.set('truckId', selectedTruckId);
        formData.set('startAddress', startAddress);
        if (startLocation) {
          formData.set('startLatitude', String(startLocation.lat));
          formData.set('startLongitude', String(startLocation.lng));
        }

        formData.set('deliveryAddress', deliveryAddress);
        if (deliveryMapsLink) {
            formData.set('deliveryGoogleMapsLink', deliveryMapsLink);
        }
        if (finalRentalDate) formData.set('rentalDate', finalRentalDate);
        if (finalReturnDate) formData.set('returnDate', finalReturnDate);
        if (deliveryLocation) {
          formData.set('latitude', String(deliveryLocation.lat));
          formData.set('longitude', String(deliveryLocation.lng));
        }
        formData.set('billingType', billingType);
        formData.set('value', String(value));
        formData.set('lumpSumValue', String(lumpSumValue));
        formData.set('attachments', JSON.stringify(attachments));
        formData.set('additionalCosts', JSON.stringify(additionalCosts));
        formData.set('recurrence', JSON.stringify(recurrenceData));

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
        } else if (result?.message && result.message !== 'success') {
            toast({ title: "Erro", description: result.message, variant: "destructive"});
        } else {
            toast({ title: "Sucesso!", description: "OS atualizada."});
            router.push('/os');
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
    const selectedPrice = account.rentalPrices?.find(p => p.id === selectedPriceId);
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


  return (
    <form action={handleFormAction} className="space-y-6">
        <input type="hidden" name="clientId" value={rental.clientId} />
        <input type="hidden" name="dumpsterIds" value={JSON.stringify(rental.dumpsterIds)} />

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
            <Label>Caçamba(s)</Label>
            <Input value={(rental.dumpsters || []).map(d => `${d.name} (${d.size}m³)`).join(', ')} disabled />
        </div>

        <div className="space-y-2">
            <Label>Cliente</Label>
            <Input value={rental.client?.name} disabled />
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
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
                <Select onValueChange={handleBaseSelect} value={selectedBaseId}>
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
        <div className="flex items-center justify-between">
            <Label htmlFor="address-input">Endereço de Entrega</Label>
            <Dialog>
                <DialogTrigger asChild>
                    <Button variant="link" size="sm" type="button" className="text-xs h-auto p-0">Inserir link do google maps</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Link do Google Maps</DialogTitle>
                        <DialogDescription>
                            Cole o link de compartilhamento do Google Maps para o endereço de destino. Isso garantirá a localização mais precisa.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="delivery-maps-link-input">Link</Label>
                        <Input 
                            id="delivery-maps-link-input"
                            value={deliveryMapsLink}
                            onChange={(e) => setDeliveryMapsLink(e.target.value)}
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
            id="address-input"
            value={deliveryAddress}
            onInputChange={handleDeliveryAddressChange}
            onLocationSelect={handleDeliveryLocationSelect}
            initialLocation={deliveryLocation}
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
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "flex-1 justify-start text-left font-normal",
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
             <Input type="time" value={rentalTime} onChange={(e) => setRentalTime(e.target.value)} className="w-full sm:w-auto" />
          </div>
          {errors?.rentalDate && <p className="text-sm font-medium text-destructive">{errors.rentalDate[0]}</p>}
        </div>
        <div className="space-y-2">
          <Label>Data de Retirada (Prevista)</Label>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "flex-1 justify-start text-left font-normal",
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
            <Input type="time" value={returnTime} onChange={(e) => setReturnTime(e.target.value)} className="w-full sm:w-auto" />
          </div>
           {errors?.returnDate && <p className="text-sm font-medium text-destructive">{errors.returnDate[0]}</p>}
        </div>
      </div>

      {!recurrenceData.enabled || recurrenceData.billingType !== 'monthly' ? (
        <Accordion type="single" collapsible defaultValue={billingType} className="w-full" onValueChange={handleAccordionChange}>
            <AccordionItem value="perDay">
            <AccordionTrigger>Cobrar por Diária</AccordionTrigger>
            <AccordionContent>
                <div className="p-4 border rounded-md space-y-4 bg-card">
                <div className="space-y-2">
                    {(account.rentalPrices && account.rentalPrices.length > 0) ? (
                    <div className="flex flex-col sm:flex-row gap-2">
                        <Select onValueChange={handlePriceSelection} value={priceId} disabled={billingType !== 'perDay'}>
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione um preço" />
                        </SelectTrigger>
                        <SelectContent>
                            {account.rentalPrices.map(p => (
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
      ) : null}
      
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
        <Textarea id="observations" name="observations" defaultValue={rental.observations ?? ''} placeholder="Ex: Deixar caçamba na calçada, portão azul." />
        {errors?.observations && <p className="text-sm font-medium text-destructive">{errors.observations[0]}</p>}
      </div>

      {canUseAttachments && accountId && (
        <div className="p-4 border rounded-md space-y-2 bg-card">
            <AttachmentsUploader 
                accountId={accountId}
                attachments={attachments || []}
                onAttachmentUploaded={handleAttachmentUploaded}
                onAttachmentDeleted={handleRemoveAttachment}
                uploadPath={`accounts/${accountId}/rentals/${rental.id}/attachments`}
            />
        </div>
      )}

      {recurrenceData.enabled && recurrenceData.billingType === 'monthly' && (
        <div className="p-4 border rounded-md space-y-2 bg-card">
            <Label htmlFor="monthlyValue">Valor Mensal</Label>
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
      )}

      <RecurrenceSelector
        value={recurrenceData}
        onChange={setRecurrenceData}
      />


      <div className="flex flex-col sm:flex-row-reverse gap-2 pt-4">
        <Button type="submit" disabled={isPending} size="lg">
          {isPending ? <Spinner size="small" /> : 'Salvar Alterações'}
        </Button>
        <Button asChild variant="outline" size="lg">
            <Link href="/os">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
