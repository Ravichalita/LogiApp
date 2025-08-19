'use client';

import { useEffect, useState, useTransition, useRef } from 'react';
import { finishRental, updateRental } from '@/lib/actions';
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

export function RentalCardActions({ rental }: { rental: PopulatedRental }) {
  const [returnDate, setReturnDate] = useState<Date | undefined>(rental.returnDate);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    // This effect listens for changes in the returnDate state
    // and submits the form programmatically.
    if (returnDate && returnDate.getTime() !== new Date(rental.returnDate).getTime()) {
      // Use a timeout to allow the hidden input to update its value
      // before the form is submitted.
      setTimeout(() => {
        formRef.current?.requestSubmit();
      }, 0);
    }
  }, [returnDate, rental.returnDate]);
  
  const handleDateUpdate = async (formData: FormData) => {
    startTransition(async () => {
      const result = await updateRental(null, formData);
       if (result.message === 'error') {
        toast({
          title: 'Erro',
          description: result.error,
          variant: 'destructive',
        });
        // Reset date on error
        setReturnDate(rental.returnDate);
      } else {
        toast({
          title: 'Sucesso!',
          description: 'Data de retirada atualizada.',
        });
      }
    });
  };

  return (
    <div>
       <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
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
            disabled={(date) => date < new Date(rental.rentalDate) || isPending}
            initialFocus
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>
      {/* Hidden form for date update */}
      <form ref={formRef} action={handleDateUpdate} className="hidden">
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
        <form action={finishRental} className="w-full">
            <input type="hidden" name="rentalId" value={rental.id} />
            <input type="hidden" name="dumpsterId" value={rental.dumpsterId} />
            <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
              <CheckCircle />
              Finalizar
            </Button>
        </form>
      </div>
    </div>
  );
}