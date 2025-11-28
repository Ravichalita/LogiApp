
'use client';

import { useState, useTransition, useEffect } from 'react';
import { updateCompletedOperationAction } from '@/lib/actions';
import type { PopulatedOperation, UserAccount, Attachment, Account, OperationType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { format, parseISO, set } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/context/auth-context';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';
import { AttachmentsUploader } from '@/components/attachments-uploader';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from '@/components/ui/select';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { AddressInput } from '@/components/address-input';
import { DialogClose } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';


const formatCurrencyForInput = (valueInCents: string): string => {
    if (!valueInCents) return '0,00';
    const numericValue = parseInt(valueInCents.replace(/\D/g, ''), 10) || 0;
    const reais = Math.floor(numericValue / 100);
    const centavos = (numericValue % 100).toString().padStart(2, '0');
    return `${reais.toLocaleString('pt-BR')},${centavos}`;
};

interface EditHistoricOperationFormProps {
  operation: PopulatedOperation;
  team: UserAccount[];
  account: Account;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditHistoricOperationForm({ operation, team, account, isOpen, onOpenChange, onSuccess }: EditHistoricOperationFormProps) {
  const { accountId, isSuperAdmin, userAccount } = useAuth();
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const [driverId, setDriverId] = useState<string | undefined>(operation.driverId);
  const [destinationAddress, setDestinationAddress] = useState<string>(operation.destinationAddress);
  const [destinationLocation, setDestinationLocation] = useState<{ lat: number, lng: number } | null>(
      operation.destinationLatitude && operation.destinationLongitude ? { lat: operation.destinationLatitude, lng: operation.destinationLongitude } : null
  );

  const [startDate, setStartDate] = useState<Date | undefined>(parseISO(operation.startDate));
  const [startTime, setStartTime] = useState<string>(format(parseISO(operation.startDate), 'HH:mm'));

  const [endDate, setEndDate] = useState<Date | undefined>(parseISO(operation.endDate));
  const [endTime, setEndTime] = useState<string>(format(parseISO(operation.endDate), 'HH:mm'));

  // Handle completedAt which might be optional in PopulatedOperation but usually present in completed items
  const initialCompletedDate = operation.completedAt ? parseISO(operation.completedAt as string) : new Date();
  const [completedDate, setCompletedDate] = useState<Date | undefined>(initialCompletedDate);
  const [completedTime, setCompletedTime] = useState<string>(format(initialCompletedDate, 'HH:mm'));

  const [value, setValue] = useState(operation.value || 0);
  const [displayValue, setDisplayValue] = useState(formatCurrencyForInput(((operation.value || 0) * 100).toString()));

  const [observations, setObservations] = useState(operation.observations || '');
  const [attachments, setAttachments] = useState<Attachment[]>(operation.attachments || []);
  const [selectedTypeIds, setSelectedTypeIds] = useState<string[]>(operation.typeIds || []);

  const canUseAttachments = isSuperAdmin || userAccount?.permissions?.canUseAttachments;

  useEffect(() => {
    setDriverId(operation.driverId);
    setDestinationAddress(operation.destinationAddress);
    setDestinationLocation(operation.destinationLatitude && operation.destinationLongitude ? { lat: operation.destinationLatitude, lng: operation.destinationLongitude } : null);
    setStartDate(parseISO(operation.startDate));
    setStartTime(format(parseISO(operation.startDate), 'HH:mm'));
    setEndDate(parseISO(operation.endDate));
    setEndTime(format(parseISO(operation.endDate), 'HH:mm'));

    const compDate = operation.completedAt ? parseISO(operation.completedAt as string) : new Date();
    setCompletedDate(compDate);
    setCompletedTime(format(compDate, 'HH:mm'));

    setValue(operation.value || 0);
    setDisplayValue(formatCurrencyForInput(((operation.value || 0) * 100).toString()));
    setObservations(operation.observations || '');
    setAttachments(operation.attachments || []);
    setSelectedTypeIds(operation.typeIds || []);
  }, [operation, isOpen]);


  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    const cents = parseInt(rawValue, 10) || 0;
    setValue(cents / 100);
    setDisplayValue(formatCurrencyForInput(rawValue));
  }

  const handleDestinationAddressChange = (newAddress: string) => {
      setDestinationAddress(newAddress);
      setDestinationLocation(null);
  }

  const handleDestinationLocationSelect = (selectedLocation: { lat: number, lng: number, address: string }) => {
      setDestinationLocation({ lat: selectedLocation.lat, lng: selectedLocation.lng });
      setDestinationAddress(selectedLocation.address);
  };

  const handleTypeToggle = (typeId: string) => {
    setSelectedTypeIds(prev =>
      prev.includes(typeId)
        ? prev.filter(id => id !== typeId)
        : [...prev, typeId]
    );
  };

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
        if (!accountId) return;
        if (selectedTypeIds.length === 0) {
             toast({ title: "Erro", description: "Selecione pelo menos um tipo de operação.", variant: "destructive"});
             return;
        }

        const combineDateTime = (date: Date | undefined, time: string): string | undefined => {
            if (!date || !time) return undefined;
            const [hours, minutes] = time.split(':').map(Number);
            return set(date, { hours, minutes }).toISOString();
        };

        const finalStartDate = combineDateTime(startDate, startTime);
        const finalEndDate = combineDateTime(endDate, endTime);
        const finalCompletedDate = combineDateTime(completedDate, completedTime);

        // We use .set() to ensure we overwrite any existing values in formData (if any)
        formData.set('id', operation.id);
        if (driverId) formData.set('driverId', driverId);

        formData.set('destinationAddress', destinationAddress);
        if (destinationLocation) {
             formData.set('destinationLatitude', String(destinationLocation.lat));
             formData.set('destinationLongitude', String(destinationLocation.lng));
        }

        if (finalStartDate) formData.set('startDate', finalStartDate);
        if (finalEndDate) formData.set('endDate', finalEndDate);
        if (finalCompletedDate) formData.set('completedAt', finalCompletedDate);

        formData.set('value', String(value));
        formData.set('observations', observations);
        formData.set('attachments', JSON.stringify(attachments));
        formData.set('typeIds', JSON.stringify(selectedTypeIds));

        const result = await updateCompletedOperationAction(accountId, null, formData);

        if (result?.message === 'success') {
            toast({ title: "Sucesso!", description: "Histórico atualizado."});
            onSuccess();
        } else {
             const error = result?.error || result?.message || "Erro desconhecido";
            toast({ title: "Erro", description: typeof error === 'string' ? error : JSON.stringify(error), variant: "destructive"});
        }
    });
  };

  const handleAttachmentUploaded = (newAttachment: Attachment) => {
    setAttachments(prev => [...prev, newAttachment]);
  };

  const handleRemoveAttachment = (attachmentToRemove: Attachment) => {
    setAttachments(prev => prev.filter(att => att.url !== attachmentToRemove.url));
  };


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>Editar Histórico de Operação #{operation.sequentialId}</DialogTitle>
                <DialogDescription>Edite as informações da operação finalizada.</DialogDescription>
            </DialogHeader>
            <form action={handleSubmit} className="space-y-4 py-2">
                 <div className="space-y-2">
                    <Label htmlFor="driverId">Motorista / Responsável</Label>
                    <Select value={driverId} onValueChange={setDriverId}>
                        <SelectTrigger>
                        <SelectValue placeholder="Selecione um membro da equipe" />
                        </SelectTrigger>
                        <SelectContent>
                        {team.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>

                 <div className="space-y-2">
                    <Label>Tipo(s) de Operação</Label>
                    <div className="grid grid-cols-2 gap-2 border p-3 rounded-md">
                        {account?.operationTypes?.map((type: OperationType) => (
                        <div key={type.id} className="flex items-center space-x-2">
                            <Checkbox
                                id={`type-${type.id}`}
                                checked={selectedTypeIds.includes(type.id)}
                                onCheckedChange={() => handleTypeToggle(type.id)}
                            />
                            <Label htmlFor={`type-${type.id}`} className="font-normal cursor-pointer">
                            {type.name}
                            </Label>
                        </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>Endereço de Destino</Label>
                    <AddressInput
                        id="historic-op-address-input"
                        value={destinationAddress}
                        onInputChange={handleDestinationAddressChange}
                        onLocationSelect={handleDestinationLocationSelect}
                        initialLocation={destinationLocation}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <Label>Início (Previsto)</Label>
                         <div className="flex gap-2">
                            <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                variant={"outline"}
                                className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}
                                >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {startDate ? format(startDate, "PPP", { locale: ptBR }) : <span>Data</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus locale={ptBR} />
                            </PopoverContent>
                            </Popover>
                             <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-[100px]" />
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label>Término (Previsto)</Label>
                        <div className="flex gap-2">
                            <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                variant={"outline"}
                                className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}
                                >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {endDate ? format(endDate, "PPP", { locale: ptBR }) : <span>Data</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus locale={ptBR} />
                            </PopoverContent>
                            </Popover>
                             <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-[100px]" />
                        </div>
                    </div>
                </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <Label>Data de Finalização</Label>
                        <div className="flex gap-2">
                             <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                variant={"outline"}
                                className={cn("w-full justify-start text-left font-normal", !completedDate && "text-muted-foreground")}
                                >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {completedDate ? format(completedDate, "PPP", { locale: ptBR }) : <span>Data</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={completedDate} onSelect={setCompletedDate} initialFocus locale={ptBR} />
                            </PopoverContent>
                            </Popover>
                             <Input type="time" value={completedTime} onChange={(e) => setCompletedTime(e.target.value)} className="w-[100px]" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="totalValue">Valor Total (R$)</Label>
                        <Input
                            id="totalValue"
                            value={displayValue}
                            onChange={handleValueChange}
                            className="text-right"
                        />
                    </div>
                 </div>

                <div className="space-y-2">
                    <Label htmlFor="observations">Observações</Label>
                    <Textarea
                        id="observations"
                        value={observations}
                        onChange={(e) => setObservations(e.target.value)}
                        placeholder="Observações do serviço..."
                    />
                </div>

                 {canUseAttachments && accountId && (
                    <div className="p-4 border rounded-md space-y-2 bg-card">
                        <Label>Anexos</Label>
                        <AttachmentsUploader
                            accountId={accountId}
                            attachments={attachments || []}
                            onAttachmentUploaded={handleAttachmentUploaded}
                            onAttachmentDeleted={handleRemoveAttachment}
                            uploadPath={`accounts/${accountId}/completed_operations/${operation.id}/attachments`}
                        />
                    </div>
                 )}

                <DialogFooter className="gap-2">
                    <DialogClose asChild>
                         <Button type="button" variant="outline">Cancelar</Button>
                    </DialogClose>
                    <Button type="submit" disabled={isPending}>
                        {isPending ? <Spinner size="small" /> : 'Salvar Alterações'}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>
  );
}
