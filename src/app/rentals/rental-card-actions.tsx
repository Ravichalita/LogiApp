
'use client';

import { useState, useTransition, useRef } from 'react';
import { finishRentalAction, cancelRentalAction } from '@/lib/actions';
import type { PopulatedRental } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { CheckCircle, MapPin, Edit, Trash2, TriangleAlert } from 'lucide-react';
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


interface RentalCardActionsProps {
    rental: PopulatedRental;
    status: ReturnType<typeof getRentalStatus>;
}


export function RentalCardActions({ rental, status }: RentalCardActionsProps) {
  const { user } = useAuth();
  const [isFinishing, startFinishTransition] = useTransition();
  const [isCanceling, startCancelTransition] = useTransition();
  const { toast } = useToast();
  
  const finishFormRef = useRef<HTMLFormElement>(null);
  const isFinalizeDisabled = status.text !== 'Ativo' && status.text !== 'Em Atraso';


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
    <div>
        <p className="text-sm text-muted-foreground">Período</p>
        <p className="font-semibold text-base">
            {format(rental.rentalDate, "dd/MM/yy", { locale: ptBR })} - {format(rental.returnDate, "dd/MM/yy", { locale: ptBR })}
        </p>

      <div className="grid grid-cols-2 w-full gap-2 mt-4">
        {status.text !== 'Pendente' && (
            <form ref={finishFormRef} action={handleFinishAction} className="w-full col-span-2">
                <input type="hidden" name="rentalId" value={rental.id} />
                <input type="hidden" name="dumpsterId" value={rental.dumpsterId} />
                <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={isFinishing || isFinalizeDisabled}>
                  {isFinishing ? <Spinner size="small" /> : <CheckCircle />}
                  Finalizar
                </Button>
            </form>
        )}

        {status.text === 'Pendente' && (
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full col-span-2">
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
                        Esta ação não pode ser desfeita. Isso irá cancelar permanentemente o agendamento deste aluguel.
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

        <EditRentalPeriodDialog rental={rental} />

        {rental.latitude && rental.longitude && (
          <Button variant="outline" className="w-full" asChild>
            <Link href={`https://www.google.com/maps?q=${rental.latitude},${rental.longitude}`} target="_blank">
                <MapPin />
                Abrir no Mapa
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
