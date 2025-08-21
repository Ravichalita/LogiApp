
'use client';

import { useState, useTransition, useRef } from 'react';
import { finishRentalAction, updateRentalAction } from '@/lib/actions';
import type { PopulatedRental } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { CalendarIcon, CheckCircle, MapPin, Edit } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { isRedirectError } from 'next/dist/client/components/redirect';
import { EditRentalPeriodDialog } from './edit-rental-period-dialog';
import type { getRentalStatus } from '../page';

interface RentalCardActionsProps {
    rental: PopulatedRental;
    status: ReturnType<typeof getRentalStatus>;
}


export function RentalCardActions({ rental, status }: RentalCardActionsProps) {
  const { user } = useAuth();
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  
  const finishFormRef = useRef<HTMLFormElement>(null);
  const isFinalizeDisabled = status.text !== 'Ativo' && status.text !== 'Em Atraso';


  const handleFinishAction = (formData: FormData) => {
    startTransition(async () => {
        if (!user) return;
        try {
            const boundAction = finishRentalAction.bind(null, user.uid);
            await boundAction(formData);
            toast({ title: "Sucesso!", description: "Aluguel finalizado." });
        } catch (error) {
            if (isRedirectError(error)) {
              // This error is expected when redirecting, so we can ignore it.
              return;
            }
            console.error("Erro ao finalizar aluguel:", error);
            const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido";
            toast({ title: "Erro", description: errorMessage, variant: "destructive"});
        }
    })
  }

  return (
    <div>
        <p className="text-sm text-muted-foreground">Período</p>
        <p className="font-semibold text-base">
            {format(rental.rentalDate, "dd/MM/yy", { locale: ptBR })} - {format(rental.returnDate, "dd/MM/yy", { locale: ptBR })}
        </p>

      <div className="flex flex-col sm:flex-row w-full gap-2 mt-4">
         <EditRentalPeriodDialog rental={rental} />

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
            <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={isPending || isFinalizeDisabled}>
              <CheckCircle />
              Finalizar
            </Button>
        </form>
      </div>
    </div>
  );
}
