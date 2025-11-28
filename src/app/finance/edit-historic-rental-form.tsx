
'use client';

import { useState, useTransition, useEffect } from 'react';
import { updateCompletedRentalAction } from '@/lib/actions';
import type { CompletedRental, UserAccount, Attachment } from '@/lib/types';
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


const formatCurrencyForInput = (valueInCents: string): string => {
    if (!valueInCents) return '0,00';
    const numericValue = parseInt(valueInCents.replace(/\D/g, ''), 10) || 0;
    const reais = Math.floor(numericValue / 100);
    const centavos = (numericValue % 100).toString().padStart(2, '0');
    return `${reais.toLocaleString('pt-BR')},${centavos}`;
};

interface EditHistoricRentalFormProps {
  rental: CompletedRental;
  team: UserAccount[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditHistoricRentalForm({ rental, team, isOpen, onOpenChange, onSuccess }: EditHistoricRentalFormProps) {
  const { accountId, isSuperAdmin, userAccount } = useAuth();
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const [assignedToId, setAssignedToId] = useState<string | undefined>(rental.assignedTo);
  const [deliveryAddress, setDeliveryAddress] = useState<string>(rental.deliveryAddress);
  const [deliveryLocation, setDeliveryLocation] = useState<{ lat: number, lng: number } | null>(
      rental.latitude && rental.longitude ? { lat: rental.latitude, lng: rental.longitude } : null
  );

  const [rentalDate, setRentalDate] = useState<Date | undefined>(parseISO(rental.rentalDate));
  const [rentalTime, setRentalTime] = useState<string>(format(parseISO(rental.rentalDate), 'HH:mm'));

  const [returnDate, setReturnDate] = useState<Date | undefined>(parseISO(rental.returnDate));
  const [returnTime, setReturnTime] = useState<string>(format(parseISO(rental.returnDate), 'HH:mm'));

  const [completedDate, setCompletedDate] = useState<Date | undefined>(parseISO(rental.completedDate));
  const [completedTime, setCompletedTime] = useState<string>(format(parseISO(rental.completedDate), 'HH:mm'));

  const [totalValue, setTotalValue] = useState(rental.totalValue || 0);
  const [displayValue, setDisplayValue] = useState(formatCurrencyForInput(((rental.totalValue || 0) * 100).toString()));

  const [observations, setObservations] = useState(rental.observations || '');
  const [attachments, setAttachments] = useState<Attachment[]>(rental.attachments || []);

  const canUseAttachments = isSuperAdmin || userAccount?.permissions?.canUseAttachments;

  useEffect(() => {
    // Reset state when rental changes
    setAssignedToId(rental.assignedTo);
    setDeliveryAddress(rental.deliveryAddress);
    setDeliveryLocation(rental.latitude && rental.longitude ? { lat: rental.latitude, lng: rental.longitude } : null);
    setRentalDate(parseISO(rental.rentalDate));
    setRentalTime(format(parseISO(rental.rentalDate), 'HH:mm'));
    setReturnDate(parseISO(rental.returnDate));
    setReturnTime(format(parseISO(rental.returnDate), 'HH:mm'));
    setCompletedDate(parseISO(rental.completedDate));
    setCompletedTime(format(parseISO(rental.completedDate), 'HH:mm'));
    setTotalValue(rental.totalValue || 0);
    setDisplayValue(formatCurrencyForInput(((rental.totalValue || 0) * 100).toString()));
    setObservations(rental.observations || '');
    setAttachments(rental.attachments || []);
  }, [rental, isOpen]);


  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    const cents = parseInt(rawValue, 10) || 0;
    setTotalValue(cents / 100);
    setDisplayValue(formatCurrencyForInput(rawValue));
  }

  const handleDeliveryAddressChange = (newAddress: string) => {
      setDeliveryAddress(newAddress);
      setDeliveryLocation(null);
  }

  const handleDeliveryLocationSelect = (selectedLocation: { lat: number, lng: number, address: string }) => {
      setDeliveryLocation({ lat: selectedLocation.lat, lng: selectedLocation.lng });
      setDeliveryAddress(selectedLocation.address);
  };

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
        if (!accountId) return;

        const combineDateTime = (date: Date | undefined, time: string): string | undefined => {
            if (!date || !time) return undefined;
            const [hours, minutes] = time.split(':').map(Number);
            return set(date, { hours, minutes }).toISOString();
        };

        const finalRentalDate = combineDateTime(rentalDate, rentalTime);
        const finalReturnDate = combineDateTime(returnDate, returnTime);
        const finalCompletedDate = combineDateTime(completedDate, completedTime);

        formData.append('id', rental.id);
        if (assignedToId) formData.append('assignedTo', assignedToId);

        formData.append('deliveryAddress', deliveryAddress);
        if (deliveryLocation) {
             formData.append('latitude', String(deliveryLocation.lat));
             formData.append('longitude', String(deliveryLocation.lng));
        }

        if (finalRentalDate) formData.append('rentalDate', finalRentalDate);
        if (finalReturnDate) formData.append('returnDate', finalReturnDate);
        if (finalCompletedDate) formData.append('completedDate', finalCompletedDate);

        formData.append('totalValue', String(totalValue));
        formData.append('observations', observations);
        formData.append('attachments', JSON.stringify(attachments));

        const result = await updateCompletedRentalAction(accountId, null, formData);

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
                <DialogTitle>Editar Histórico de Aluguel #{rental.sequentialId}</DialogTitle>
                <DialogDescription>Edite as informações do serviço finalizado.</DialogDescription>
            </DialogHeader>
            <form action={handleSubmit} className="space-y-4 py-2">
                 <div className="space-y-2">
                    <Label htmlFor="assignedTo">Responsável</Label>
                    <Select value={assignedToId} onValueChange={setAssignedToId}>
                        <SelectTrigger>
                        <SelectValue placeholder="Selecione um membro da equipe" />
                        </SelectTrigger>
                        <SelectContent>
                        {team.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label>Endereço de Entrega</Label>
                    <AddressInput
                        id="historic-address-input"
                        value={deliveryAddress}
                        onInputChange={handleDeliveryAddressChange}
                        onLocationSelect={handleDeliveryLocationSelect}
                        initialLocation={deliveryLocation}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <Label>Data de Entrega</Label>
                         <div className="flex gap-2">
                            <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                variant={"outline"}
                                className={cn("w-full justify-start text-left font-normal", !rentalDate && "text-muted-foreground")}
                                >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {rentalDate ? format(rentalDate, "PPP", { locale: ptBR }) : <span>Data</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={rentalDate} onSelect={setRentalDate} initialFocus locale={ptBR} />
                            </PopoverContent>
                            </Popover>
                             <Input type="time" value={rentalTime} onChange={(e) => setRentalTime(e.target.value)} className="w-[100px]" />
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label>Data de Retirada</Label>
                        <div className="flex gap-2">
                            <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                variant={"outline"}
                                className={cn("w-full justify-start text-left font-normal", !returnDate && "text-muted-foreground")}
                                >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {returnDate ? format(returnDate, "PPP", { locale: ptBR }) : <span>Data</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={returnDate} onSelect={setReturnDate} initialFocus locale={ptBR} />
                            </PopoverContent>
                            </Popover>
                             <Input type="time" value={returnTime} onChange={(e) => setReturnTime(e.target.value)} className="w-[100px]" />
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
                            uploadPath={`accounts/${accountId}/completed_rentals/${rental.id}/attachments`}
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
