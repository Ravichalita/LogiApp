
'use client';

import { useState, useTransition, useRef } from 'react';
import { finishRentalAction, cancelRentalAction } from '@/lib/actions';
import type { PopulatedRental } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { CheckCircle, MapPin, Edit, Trash2, TriangleAlert, CircleDollarSign, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { EditRentalPeriodDialog } from './edit-rental-period-dialog';
import type { getRentalStatus } from '../page';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Spinner } from '@/components/ui/spinner';
import { differenceInCalendarDays } from 'date-fns';


interface RentalCardActionsProps {
    rental: PopulatedRental;
    status: ReturnType<typeof getRentalStatus>;
}

function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
}

function calculateRentalDays(startDate: Date, endDate: Date): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = differenceInCalendarDays(end, start);
    return Math.max(diff, 1); // Ensure at least 1 day is charged
}

function GoogleMapsIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 13 18" fill="none" {...props}>
            <path d="M6.5 0C2.91 0 0 2.822 0 6.3C0 9.249 2.583 13.338 6.5 18C10.417 13.338 13 9.249 13 6.3C13 2.822 10.09 0 6.5 0ZM6.5 8.55C5.332 8.55 4.383 7.623 4.383 6.475C4.383 5.327 5.332 4.4 6.5 4.4C7.668 4.4 8.617 5.327 8.617 6.475C8.617 7.623 7.668 8.55 6.5 8.55Z" fill="currentColor"/>
        </svg>
    )
}


export function RentalCardActions({ rental, status }: RentalCardActionsProps) {
  const { user } = useAuth();
  const [isFinishing, startFinishTransition] = useTransition();
  const [isCanceling, startCancelTransition] = useTransition();
  const { toast } = useToast();
  
  const finishFormRef = useRef<HTMLFormElement>(null);
  const isFinalizeDisabled = status.text !== 'Ativo' && status.text !== 'Em Atraso';
  
  const rentalDays = calculateRentalDays(rental.rentalDate, rental.returnDate);
  const totalValue = rental.value * rentalDays;

  const handleFinishAction = (formData: FormData) => {
    startFinishTransition(async () => {
        if (!user) return;
        // The redirect error is expected and handled by Next.js, no need for try/catch here.
        const boundAction = finishRentalAction.bind(null, user.uid);
        await boundAction(formData);
        // This toast might not be shown due to the redirect, which is acceptable.
        toast({ title: "Sucesso!", description: "Aluguel finalizado." });
    })
  }

  const handleCancelAction = () => {
     startCancelTransition(async () => {
        if (!user) return;
        const result = await cancelRentalAction(user.uid, rental.id);
        if (result.message === 'error') {
            toast({ title: "Erro", description: result.error, variant: "destructive"});
        } else {
            toast({ title: "Sucesso!", description: "Agendamento cancelado." });
        }
     });
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground">Local de Entrega</span>
                    <span className="font-medium">{rental.deliveryAddress}</span>
                </div>
            </div>
            {!!rental.latitude && !!rental.longitude && (
              <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" asChild>
                <Link href={`https://www.google.com/maps?q=${rental.latitude},${rental.longitude}`} target="_blank">
                    <GoogleMapsIcon className="h-4 w-4" />
                    <span className="sr-only">Abrir no Mapa</span>
                </Link>
              </Button>
            )}
        </div>
        <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
                <CalendarDays className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground">Período</span>
                     <p className="font-semibold text-base">
                        {format(rental.rentalDate, "dd/MM/yy", { locale: ptBR })} - {format(rental.returnDate, "dd/MM/yy", { locale: ptBR })}
                    </p>
                </div>
            </div>
            <EditRentalPeriodDialog rental={rental}>
                 <Button variant="outline" size="icon" className="h-8 w-8 shrink-0">
                    <Edit className="h-4 w-4" />
                    <span className="sr-only">Editar Período</span>
                </Button>
            </EditRentalPeriodDialog>
        </div>
        <div className="flex items-start gap-3">
            <CircleDollarSign className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
            <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">Valor Total Previsto ({rentalDays} {rentalDays > 1 ? 'dias' : 'dia'})</span>
                <span className="font-medium">{formatCurrency(totalValue)}</span>
            </div>
        </div>
      </div>
       <div className="flex flex-col md:flex-row w-full gap-2 mt-auto md:ml-auto md:w-auto">
            {status.text !== 'Pendente' && (
                <form ref={finishFormRef} action={handleFinishAction} className="w-full md:w-auto">
                    <input type="hidden" name="rentalId" value={rental.id} />
                    <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={isFinishing || isFinalizeDisabled}>
                    {isFinishing ? <Spinner size="small" /> : <CheckCircle />}
                    Finalizar Aluguel
                    </Button>
                </form>
            )}

            {status.text === 'Pendente' && (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="w-full">
                            <Trash2 />
                            Cancelar Agendamento
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <TriangleAlert className="h-6 w-6 text-destructive" />
                            Você tem certeza?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta ação não pode ser desfeita. Isso irá cancelar permanentemente o agendamento deste aluguel e a caçamba voltará a ficar disponível.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isCanceling}>Voltar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleCancelAction} disabled={isCanceling} className="bg-destructive hover:bg-destructive/90">
                            {isCanceling ? <Spinner size="small" /> : 'Sim, Cancelar'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </div>
    </div>
  );
}
