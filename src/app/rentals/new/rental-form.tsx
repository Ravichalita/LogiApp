

'use client';

import { useEffect, useState, useTransition, useRef } from 'react';
import { createRental } from '@/lib/actions';
import type { Client, Dumpster, Location, UserAccount, RentalPrice, Attachment } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CalendarIcon, User, AlertCircle } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO, isBefore as isBeforeDate, startOfDay, addDays, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/context/auth-context';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AddressInput } from '@/components/address-input';
import { AttachmentsUploader } from '@/components/attachments-uploader';

const initialState = {
  errors: {},
  message: '',
};

export type DumpsterForForm = Dumpster & { 
  specialStatus?: string;
  disabled: boolean;
  disabledRanges: { from: Date; to: Date }[];
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


export function RentalForm({ dumpsters, clients, team, rentalPrices }: RentalFormProps) {
  const { accountId, user, userAccount, isSuperAdmin } = useAuth();
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  
  const [selectedDumpsterId, setSelectedDumpsterId] = useState<string | undefined>();
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>();
  const [assignedToId, setAssignedToId] = useState<string | undefined>(userAccount?.id);
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [rentalDate, setRentalDate] = useState<Date | undefined>();
  const [returnDate, setReturnDate] = useState<Date | undefined>();
  const [location, setLocation] = useState<Omit<Location, 'address'> | null>(null);
  const [errors, setErrors] = useState<any>({});
  const [value, setValue] = useState(0); // Store value as a number
  const [displayValue, setDisplayValue] = useState(''); // Store formatted string for input
  const [priceId, setPriceId] = useState<string | undefined>();
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const selectedDumpsterInfo = dumpsters.find(d => d.id === selectedDumpsterId);

  const isViewer = userAccount?.role === 'viewer';
  const assignableUsers = isViewer && userAccount ? [userAccount] : team;
  const canUseAttachments = isSuperAdmin || userAccount?.permissions?.canUseAttachments;


  useEffect(() => {
    // Initialize dates only on the client to avoid hydration mismatch
    setRentalDate(new Date());
    setAssignedToId(userAccount?.id)
  }, [userAccount]);

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
        
        if (selectedDumpsterId) formData.set('dumpsterId', selectedDumpsterId);
        if (selectedClientId) formData.set('clientId', selectedClientId);
        if (assignedToId) formData.set('assignedTo', assignedToId);
        
        formData.set('deliveryAddress', deliveryAddress);
        if (rentalDate) formData.set('rentalDate', rentalDate.toISOString());
        if (returnDate) formData.set('returnDate', returnDate.toISOString());
        if (location) {
          formData.set('latitude', String(location.lat));
          formData.set('longitude', String(location.lng));
        }
        
        formData.set('value', String(value));
        formData.set('attachments', JSON.stringify(attachments));

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

  const isDeliveryOnReturnDay = rentalDate && selectedDumpsterInfo?.disabledRanges.some(range => isSameDay(addDays(range.to, 1), rentalDate));

  const getNextBookingDate = (): Date | null => {
      if (!rentalDate || !selectedDumpsterInfo) return null;

      const nextBooking = selectedDumpsterInfo.disabledRanges
          .map(range => range.from)
          .find(from => from > rentalDate);
      
      return nextBooking || null;
  }

  const nextBookingDate = getNextBookingDate();

  return (
    <form action={handleFormAction} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="dumpsterId">Caçamba</Label>
        <Select name="dumpsterId" onValueChange={setSelectedDumpsterId} required>
          <SelectTrigger>
            <SelectValue placeholder="Selecione uma caçamba disponível" />
          </SelectTrigger>
          <SelectContent>
            {dumpsters.map(d => (
              <SelectItem key={d.id} value={d.id} disabled={d.status === 'Em Manutenção'}>
                <div className="flex justify-between w-full">
                    <span>{`${d.name} (${d.size}m³, ${d.color})`}</span>
                    {d.specialStatus && (
                      <span className={cn(
                        "text-xs ml-4 font-semibold",
                        d.specialStatus.startsWith('Alugada') ? 'text-destructive' :
                        d.specialStatus.startsWith('Reservada') ? 'text-muted-foreground' :
                        d.specialStatus.startsWith('Encerra hoje') ? 'text-yellow-600 dark:text-yellow-400' :
                        'text-red-500' // fallback for maintenance
                      )}>
                        {d.specialStatus}
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
        <Label htmlFor="address-input">Endereço de Entrega</Label>
        <AddressInput
            id="address-input"
            value={deliveryAddress}
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
                disabled={selectedDumpsterInfo?.disabledRanges}
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
                disabled={(date) => {
                    if (!rentalDate || isBeforeDate(date, rentalDate)) {
                        return true;
                    }
                    if (nextBookingDate && date >= nextBookingDate) {
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
          {isDeliveryOnReturnDay && (
              <Alert variant="warning">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Atenção: Giro Rápido!</AlertTitle>
                  <AlertDescription>
                     A entrega coincide com a data de retirada de outro aluguel para esta caçamba.
                  </AlertDescription>
              </Alert>
          )}
          {nextBookingDate && (
             <Alert variant="info">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Disponibilidade Limitada</AlertTitle>
                  <AlertDescription>
                    Esta caçamba já tem um agendamento futuro a partir de {format(nextBookingDate, "dd/MM/yyyy", { locale: ptBR })}. A data de retirada deve ser anterior a isso.
                  </AlertDescription>
              </Alert>
          )}
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
                    id="value_display"
                    name="value_display"
                    value={displayValue}
                    onChange={handleValueChange}
                    placeholder="R$ 0,00"
                    required
                    className="w-1/3 text-right"
                    />
            </div>
        ) : (
            <Input
            id="value_display"
            name="value_display"
            value={displayValue}
            onChange={handleValueChange}
            placeholder="R$ 0,00"
            required
            className="text-right"
            />
        )}
        {errors?.value && <p className="text-sm font-medium text-destructive">{errors.value[0]}</p>}
      </div>

       <div className="space-y-2">
        <Label htmlFor="observations">Observações</Label>
        <Textarea id="observations" name="observations" placeholder="Ex: Deixar caçamba na calçada, portão azul." />
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
