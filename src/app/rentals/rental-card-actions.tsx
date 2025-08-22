
'use client';

import { useState, useTransition, useRef } from 'react';
import { finishRentalAction, cancelRentalAction } from '@/lib/actions';
import type { PopulatedRental } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { CheckCircle, MapPin, Edit, Trash2, TriangleAlert, CircleDollarSign, CalendarDays, ChevronDown, Phone, Mail, FileText } from 'lucide-react';
import { format, differenceInCalendarDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { EditRentalPeriodDialog } from './edit-rental-period-dialog';
import type { getRentalStatus } from '../page';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { Separator } from '@/components/ui/separator';

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

function calculateRentalDays(startDate: string, endDate: string): number {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const diff = differenceInCalendarDays(end, start);
    return Math.max(diff, 1); // Ensure at least 1 day is charged
}

function formatPhoneNumberForWhatsApp(phone: string): string {
    let digits = phone.replace(/\D/g, '');
    // Ensure it has the country code (assuming Brazil 55)
    if (digits.length === 10 || digits.length === 11) {
        digits = `55${digits}`;
    }
    return digits;
}


function GoogleMapsIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 13 18" fill="none" {...props}>
            <path d="M6.5 0C2.91 0 0 2.822 0 6.3C0 9.249 2.583 13.338 6.5 18C10.417 13.338 13 9.249 13 6.3C13 2.822 10.09 0 6.5 0ZM6.5 8.55C5.332 8.55 4.383 7.623 4.383 6.475C4.383 5.327 5.332 4.4 6.5 4.4C7.668 4.4 8.617 5.327 8.617 6.475C8.617 7.623 7.668 8.55 6.5 8.55Z" fill="currentColor"/>
        </svg>
    )
}

export function RentalCardActions({ rental, status }: RentalCardActionsProps) {
  const { accountId, userAccount } = useAuth();
  const [isFinishing, startFinishTransition] = useTransition();
  const [isCanceling, startCancelTransition] = useTransition();
  const { toast } = useToast();
  
  const finishFormRef = useRef<HTMLFormElement>(null);

  const isAdmin = userAccount?.role === 'admin';
  const canEdit = isAdmin || userAccount?.permissions?.canEditRentals;
  const canDelete = isAdmin || userAccount?.permissions?.canDeleteItems;

  const isFinalizeDisabled = (status.text !== 'Ativo' && status.text !== 'Em Atraso');
  
  const rentalDays = calculateRentalDays(rental.rentalDate, rental.returnDate);
  const totalValue = rental.value * rentalDays;

  const handleFinishAction = (formData: FormData) => {
    startFinishTransition(async () => {
        if (!accountId) return;
        const boundAction = finishRentalAction.bind(null, accountId);
        await boundAction(formData);
        toast({ title: "Sucesso!", description: "Aluguel finalizado." });
    })
  }

  const handleCancelAction = () => {
     startCancelTransition(async () => {
        if (!accountId) return;
        const result = await cancelRentalAction(accountId, rental.id);
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
                        {format(parseISO(rental.rentalDate), "dd/MM/yy", { locale: ptBR })} - {format(parseISO(rental.returnDate), "dd/MM/yy", { locale: ptBR })}
                    </p>
                </div>
            </div>
            {canEdit && (
              <EditRentalPeriodDialog rental={rental}>
                  <Button variant="outline" size="icon" className="h-8 w-8 shrink-0">
                      <Edit className="h-4 w-4" />
                      <span className="sr-only">Editar Período</span>
                  </Button>
              </EditRentalPeriodDialog>
            )}
        </div>
        <div className="flex items-start gap-3">
            <CircleDollarSign className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
            <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">Valor Total Previsto ({rentalDays} {rentalDays > 1 ? 'dias' : 'dia'})</span>
                <span className="font-medium">{formatCurrency(totalValue)}</span>
            </div>
        </div>

        <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="client-details" className="border-none">
                <Separator />
                 <AccordionTrigger className="text-sm text-primary hover:no-underline p-0 pt-3 justify-center">
                    Detalhes do Cliente
                    <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 ml-1" />
                </AccordionTrigger>
                <AccordionContent className="pt-3 space-y-3">
                     <div className="flex items-start gap-3">
                        <Phone className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                        <div className="flex flex-col">
                            <span className="text-sm text-muted-foreground">Telefone</span>
                             <a 
                                href={`https://wa.me/${formatPhoneNumberForWhatsApp(rental.client?.phone ?? '')}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="font-medium text-primary hover:underline"
                            >
                                {rental.client?.phone}
                            </a>
                            <span className="text-xs text-muted-foreground">Toque para abrir no WhatsApp</span>
                        </div>
                    </div>
                    {rental.client?.email && (
                        <div className="flex items-start gap-3">
                            <Mail className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                            <div className="flex flex-col">
                            <span className="text-sm text-muted-foreground">Email</span>
                            <span className="font-medium">{rental.client.email}</span>
                            </div>
                        </div>
                    )}
                    {rental.client?.observations && (
                        <div className="flex items-start gap-3">
                            <FileText className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                            <div className="flex flex-col">
                            <span className="text-sm text-muted-foreground">Observações</span>
                            <p className="font-medium whitespace-pre-wrap">{rental.client.observations}</p>
                            </div>
                        </div>
                    )}
                </AccordionContent>
            </AccordionItem>
        </Accordion>

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

            {status.text === 'Pendente' && canDelete && (
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
