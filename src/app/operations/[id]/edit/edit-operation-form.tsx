
'use client';

import { useState, useTransition, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CalendarIcon, ChevronDown } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format, set, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/context/auth-context';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { AddressInput } from '@/components/address-input';
import type { Location, Client, UserAccount, Truck, Account, AdditionalCost, OperationType, PopulatedOperation } from '@/lib/types';
import { updateOperationAction } from '@/lib/actions';
import { Input } from '@/components/ui/input';
import { CostsDialog } from '../../new/costs-dialog';
import { OperationTypeDialog } from '../../new/operation-type-dialog';

interface EditOperationFormProps {
  operation: PopulatedOperation;
  clients: Client[];
  team: UserAccount[];
  trucks: Truck[];
  operationTypes: OperationType[];
  account: Account | null;
}

const formatCurrencyForInput = (valueInCents: string): string => {
    if (!valueInCents) return '0,00';
    const numericValue = parseInt(valueInCents.replace(/\D/g, ''), 10) || 0;
    const reais = Math.floor(numericValue / 100);
    const centavos = (numericValue % 100).toString().padStart(2, '0');
    return `${reais.toLocaleString('pt-BR')},${centavos}`;
};

export function EditOperationForm({ operation, clients, team, trucks, operationTypes, account }: EditOperationFormProps) {
  const { accountId } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<any>({});
  const { toast } = useToast();

  const [startDate, setStartDate] = useState<Date | undefined>(operation.startDate ? parseISO(operation.startDate) : undefined);
  const [startTime, setStartTime] = useState<string>(operation.startDate ? format(parseISO(operation.startDate), 'HH:mm') : '');
  const [endDate, setEndDate] = useState<Date | undefined>(operation.endDate ? parseISO(operation.endDate) : undefined);
  const [endTime, setEndTime] = useState<string>(operation.endDate ? format(parseISO(operation.endDate), 'HH:mm') : '');

  const [destinationAddress, setDestinationAddress] = useState(operation.destinationAddress);
  const [destinationLocation, setDestinationLocation] = useState<Omit<Location, 'address'> | null>(
    operation.destinationLatitude && operation.destinationLongitude
      ? { lat: operation.destinationLatitude, lng: operation.destinationLongitude }
      : null
  );

  const [selectedOperationTypeIds, setSelectedOperationTypeIds] = useState<string[]>(operation.typeIds || []);
  const [baseValue, setBaseValue] = useState(operation.value || 0);
  const [additionalCosts, setAdditionalCosts] = useState<AdditionalCost[]>(operation.additionalCosts || []);
  const [travelCost, setTravelCost] = useState<number | null>(operation.travelCost || 0);

  const handleDestinationLocationSelect = (selectedLocation: Location) => {
    setDestinationLocation({ lat: selectedLocation.lat, lng: selectedLocation.lng });
    setDestinationAddress(selectedLocation.address);
  };

  const handleDestinationAddressChange = (newAddress: string) => {
    setDestinationAddress(newAddress);
  };
  
  const handleBaseValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    const cents = parseInt(rawValue, 10) || 0;
    setBaseValue(cents / 100);
  }

  useEffect(() => {
    const newBaseValue = selectedOperationTypeIds.reduce((total, id) => {
        const selectedType = operationTypes.find(t => t.id === id);
        return total + (selectedType?.value || 0);
    }, 0);
    setBaseValue(newBaseValue);
  }, [selectedOperationTypeIds, operationTypes]);


  const handleFormAction = (formData: FormData) => {
    startTransition(async () => {
      if (!accountId) {
        toast({ title: "Erro", description: "Você precisa estar logado.", variant: "destructive" });
        return;
      }
      
      formData.set('id', operation.id);

      const combineDateTime = (date: Date | undefined, time: string): string | undefined => {
        if (!date || !time) return undefined;
        const [hours, minutes] = time.split(':').map(Number);
        return set(date, { hours, minutes }).toISOString();
      };

      const finalStartDate = combineDateTime(startDate, startTime);
      const finalEndDate = combineDateTime(endDate, endTime);
      
      if (finalStartDate) formData.set('startDate', finalStartDate);
      if (finalEndDate) formData.set('endDate', finalEndDate);
      
      formData.set('destinationAddress', destinationAddress);
      if (destinationLocation) {
        formData.set('destinationLatitude', String(destinationLocation.lat));
        formData.set('destinationLongitude', String(destinationLocation.lng));
      }
      
      formData.set('typeIds', JSON.stringify(selectedOperationTypeIds));
      formData.set('value', String(baseValue));
      formData.set('additionalCosts', JSON.stringify(additionalCosts));
      if (travelCost !== null) {
          formData.set('travelCost', String(travelCost));
      }

      const boundAction = updateOperationAction.bind(null, accountId);
      const result = await boundAction(null, formData);

      if (result?.errors) {
        setErrors(result.errors);
        const errorMessages = Object.values(result.errors).flat().join(' ');
        toast({
          title: "Erro de Validação",
          description: errorMessages,
          variant: "destructive"
        });
      } else if (result?.message && result.message !== 'success') {
        toast({ title: "Erro", description: result.message, variant: "destructive"});
      } else if (!result?.errors) {
        toast({ title: "Sucesso!", description: "Operação atualizada."});
      }
    });
  };

  return (
    <form action={handleFormAction} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="type">Tipo de Operação</Label>
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
          <Label htmlFor="clientId">Cliente</Label>
          <Select name="clientId" defaultValue={operation.clientId} required>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um cliente" />
            </SelectTrigger>
            <SelectContent>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {errors?.clientId && <p className="text-sm font-medium text-destructive">{errors.clientId[0]}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="driverId">Responsável</Label>
          <Select name="driverId" defaultValue={operation.driverId} required>
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
          <Label htmlFor="truckId">Caminhão</Label>
          <Select name="truckId" defaultValue={operation.truckId} required>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um caminhão" />
            </SelectTrigger>
            <SelectContent>
              {trucks.map(t => <SelectItem key={t.id} value={t.id}>{t.name} ({t.plate})</SelectItem>)}
            </SelectContent>
          </Select>
          {errors?.truckId && <p className="text-sm font-medium text-destructive">{errors.truckId[0]}</p>}
        </div>
      </div>

      <div className="p-4 border rounded-md space-y-4">
        <div className="space-y-2">
          <Label>Início da Operação</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "PPP", { locale: ptBR }) : <span>Escolha uma data</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus locale={ptBR} />
              </PopoverContent>
            </Popover>
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          {errors?.startDate && <p className="text-sm font-medium text-destructive">{errors.startDate[0]}</p>}
        </div>

        <div className="space-y-2">
          <Label>Término (Previsão)</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "PPP", { locale: ptBR }) : <span>Escolha uma data</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus locale={ptBR} />
              </PopoverContent>
            </Popover>
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
          {errors?.endDate && <p className="text-sm font-medium text-destructive">{errors.endDate[0]}</p>}
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="destination-address-input">Endereço de Destino</Label>
        <AddressInput id="destination-address-input" value={destinationAddress} onInputChange={handleDestinationAddressChange} onLocationSelect={handleDestinationLocationSelect} />
        {errors?.destinationAddress && <p className="text-sm font-medium text-destructive">{errors.destinationAddress[0]}</p>}
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <div className="grid gap-2">
            <Label className="hidden md:block">Custos Adicionais</Label>
            <CostsDialog costs={additionalCosts} onSave={setAdditionalCosts}>
              <Button type="button" variant="outline" className="w-full">
                {additionalCosts.length > 0 ? `Editar Custos (${additionalCosts.length})` : 'Adicionar Custos'}
              </Button>
            </CostsDialog>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="value" className="text-left md:text-right">Valor do Serviço</Label>
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
        </div>
        {errors?.value && <p className="text-sm font-medium text-destructive">{errors.value[0]}</p>}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="observations">Observações</Label>
        <Textarea id="observations" name="observations" defaultValue={operation.observations ?? ''} />
      </div>

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
