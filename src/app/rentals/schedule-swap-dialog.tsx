
'use client';

import { useState, useTransition, useEffect } from 'react';
import { updateRentalAction } from '@/lib/actions';
import type { PopulatedRental } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { Spinner } from '@/components/ui/spinner';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar as CalendarIcon, ArrowRightLeft } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format, set, parseISO, isBefore as isBeforeDate } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ScheduleSwapDialogProps {
  rental: PopulatedRental;
}

export function ScheduleSwapDialog({ rental }: ScheduleSwapDialogProps) {
  const { accountId } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [swapDate, setSwapDate] = useState<Date | undefined>(rental.swapDate ? parseISO(rental.swapDate) : undefined);
  const [swapTime, setSwapTime] = useState<string>(rental.swapDate ? format(parseISO(rental.swapDate), 'HH:mm') : '08:00');
  const { toast } = useToast();

  const handleSave = () => {
    if (!accountId || !swapDate) {
      toast({ title: 'Erro', description: 'Por favor, selecione uma data para a troca.', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      const [hours, minutes] = swapTime.split(':').map(Number);
      const finalSwapDate = set(swapDate, { hours, minutes });

      const formData = new FormData();
      formData.set('id', rental.id);
      formData.set('swapDate', finalSwapDate.toISOString());

      const boundAction = updateRentalAction.bind(null, accountId);
      const result = await boundAction(null, formData);

      if (result?.errors) {
        const errorMessages = Object.values(result.errors).flat().join(' ');
        toast({ title: 'Erro de Validação', description: errorMessages, variant: 'destructive' });
      } else if (result?.message && result.message !== 'success') {
        toast({ title: 'Erro', description: result.message, variant: 'destructive' });
      } else {
        toast({ title: 'Sucesso', description: 'Troca de caçamba agendada.' });
        setIsOpen(false);
      }
    });
  };

  useEffect(() => {
    if (isOpen) {
      setSwapDate(rental.swapDate ? parseISO(rental.swapDate) : undefined);
      setSwapTime(rental.swapDate ? format(parseISO(rental.swapDate), 'HH:mm') : '08:00');
    }
  }, [isOpen, rental.swapDate]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-auto py-1 px-2 text-xs">
          <ArrowRightLeft className="mr-1 h-3 w-3" />
          Agendar Troca
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Agendar Troca de Caçamba</DialogTitle>
          <DialogDescription>
            Selecione a data e o horário para a troca da caçamba da OS #{rental.sequentialId}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
            <div className="space-y-2">
                <Label>Nova Data e Hora para a Troca</Label>
                <div className="flex items-center gap-2">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className={cn("w-full justify-start text-left font-normal", !swapDate && "text-muted-foreground")}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {swapDate ? format(swapDate, "PPP", { locale: ptBR }) : <span>Escolha uma data</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar
                                mode="single"
                                selected={swapDate}
                                onSelect={setSwapDate}
                                disabled={(date) => isBeforeDate(date, parseISO(rental.rentalDate))}
                                initialFocus
                                locale={ptBR}
                            />
                        </PopoverContent>
                    </Popover>
                    <Input
                        type="time"
                        value={swapTime}
                        onChange={(e) => setSwapTime(e.target.value)}
                        className="w-auto"
                    />
                </div>
            </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isPending}>
              Cancelar
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSave} disabled={isPending || !swapDate}>
            {isPending ? <Spinner size="small" /> : 'Salvar Agendamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
