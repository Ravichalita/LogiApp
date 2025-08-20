'use client';

import { useEffect, useState, useTransition, useRef } from 'react';
import { finishRentalAction, updateRentalAction } from '@/lib/actions';
import type { PopulatedRental } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, CheckCircle, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';

export function RentalCardActions({ rental }: { rental: PopulatedRental }) {
  const { user } = useAuth();
  const [returnDate, setReturnDate] = useState<Date | undefined>(new Date(rental.returnDate));
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  
  // This ref is needed to programmatically submit the hidden form
  const updateFormRef = useRef<HTMLFormElement>(null);
  const finishFormRef = useRef<HTMLFormElement>(null);

  // Effect to auto-submit the form when a new date is picked
  useEffect(() => {
    // Only submit if the date has actually changed from the original
    if (returnDate && returnDate.getTime() !== new Date(rental.returnDate).getTime()) {
      // Timeout to ensure the hidden input value is updated before submit
      setTimeout(() => {
        updateFormRef.current?.requestSubmit();
      }, 0);
    }
  }, [returnDate, rental.returnDate]);
  
  const handleDateUpdateAction = (formData: FormData) => {
    startTransition(async () => {
      if (!user) return;
      const boundAction = updateRentalAction.bind(null, user.uid, {});
      const result = await boundAction(formData);
       if (result.message === 'error') {
        toast({
          title: 'Erro',
          description: result.error,
          variant: 'destructive',
        });
        // Reset date on error
        setReturnDate(new Date(rental.returnDate));
      } else {
        toast({
          title: 'Sucesso!',
          description: 'Data de retirada atualizada.',
        });
      }
    });
  };

  const handleFinishAction = (formData: FormData) => {
    startTransition(async () => {
        if (!user) return;
        try {
            const boundAction = finishRentalAction.bind(null, user.uid);
            await boundAction(formData);
            toast({ title: "Sucesso!", description: "Aluguel finalizado." });
        } catch (error: any) {
            toast({ title: "Erro", description: error.message, variant: "destructive"});
        }
    })
  }

  return (
    <div>
       <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            disabled={isPending}
            className={cn(
              "w-auto justify-start text-left font-semibold p-0 h-auto",
              !returnDate && "text-muted-foreground"
            )}
          >
            <span className="text-base">{returnDate ? format(returnDate, "PPP", { locale: ptBR }) : <span>Escolha uma data</span>}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            selected={returnDate}
            onSelect={setReturnDate}
            disabled={(date) => new Date(date).setHours(0,0,0,0) < new Date(rental.rentalDate).setHours(0,0,0,0) || isPending}
            initialFocus
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>

      {/* Hidden form for date update */}
      <form ref={updateFormRef} action={handleDateUpdateAction} className="hidden">
        <input type="hidden" name="id" value={rental.id} />
        <input type="hidden" name="returnDate" value={returnDate?.toISOString()} />
      </form>

      <div className="flex w-full gap-2 mt-6">
        {rental.latitude && rental.longitude && (
          <Button variant="outline" className="w-full" asChild>
            <Link href={`https://www.google.com/maps?q=${rental.latitude},${rental.longitude}`} target="_blank">
                <MapPin />
                Abrir no Mapa
            </Link>
          </Button>
        )}
        <form ref={finishFormRef} action={handleFinishAction} className="w-full">
            <input type="hidden" name="rentalId" value={rental.id} />
            <input type="hidden" name="dumpsterId" value={rental.dumpsterId} />
            <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={isPending}>
              <CheckCircle />
              Finalizar
            </Button>
        </form>
      </div>
    </div>
  );
}
