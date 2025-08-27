
'use client';

import { useState, useTransition, useRef } from 'react';
import { finishRentalAction, deleteRentalAction } from '@/lib/actions';
import type { PopulatedRental } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { CheckCircle, MapPin, Edit, Trash2, TriangleAlert, CircleDollarSign, CalendarDays, ChevronDown, Phone, Mail, FileText, MoreVertical, Plus, Minus, XCircle } from 'lucide-react';
import { format, differenceInCalendarDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';

import type { getRentalStatus } from '../page';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

function WhatsAppIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 12c0 1.74.45 3.38 1.25 4.85L2 22l5.25-1.38c1.41.75 3 1.18 4.75 1.18h.01c5.46 0 9.9-4.45 9.9-9.9S17.5 2 12.04 2M9.46 7.03c.27-.27.64-.45.92-.45.3 0 .58.07.78.22.2.15.33.35.48.57.15.22.3.48.4.7.13.22.18.46.18.7s-.06.48-.17.72c-.12.24-.28.48-.48.7-.2.2-.42.4-.68.6-.25.2-.5.38-.78.53-.28.15-.56.28-.84.38-.28.1-.53.15-.75.15-.3 0-.6-.06-.86-.17-.27-.12-.52-.28-.75-.48s-.42-.42-.6-.68c-.18-.25-.33-.52-.45-.8-.12-.28-.18-.58-.18-.9s.06-.6.18-.88c.12-.28.28-.53.48-.75.2-.22.42-.42.68-.58.25-.17.52-.3.8-.4.28-.1.55-.13.8-.13m5.05 6.4c-.18.3-.42.56-.72.75-.3.2-.63.33-.98.42-.35.08-.7.13-1.04.13-.58 0-1.13-.1-1.65-.3-.52-.2-1-.48-1.4- pleasurable.83s-.75-.8-1.04-1.3c-.3-.5-.45-1.03-.45-1.6 0-.55.12-1.08.36-1.56.24-.48.56-.9.92-1.26.38-.36.8-.66 1.28-.88.48-.22 1-.33 1.56-.33.4 0 .78.06 1.12.18.34.12.65.28.9.5.25.2.45.45.6.72.15.28.22.56.22.85 0 .3-.07.6-.2.88-.13.28-.3.53-.5.75-.2.22-.43.42-.7.58-.25.17-.48.3-.68.38-.2.08-.36.14-.48.17-.12.03-.22.05-.3.05-.15 0-.28-.02-.4-.06-.12-.04-.23-.1-.32-.15-.1-.06-.18-.12-.25-.2-.07-.08-.13-.16-.17-.25-.04-.08-.07-.17-.08-.25s-.02-.17-.02-.25c0-.08.01-.16.03-.23.02-.07.05-.14.08-.2.03-.06.08-.12.13-.17.05-.05.1-.1.15-.13.05-.03.1-.06.15-.08s.1-.03.15-.03c.06 0 .1.01.14.02.04.01.07.02.1.04.03.02.06.04.08.06.02.02.05.05.07.08.02.03.04.06.05.1.01.03.02.06.02.1s-.01.08-.02.1c-.01.03-.03.06-.05.08-.02.02-.05.05-.08.07-.03.02-.06.04-.1.06-.04.02-.08.04-.13.05-.05.01-.1.02-.15.02-.12 0-.23-.02-.34-.07-.1-.05-.2-.12-.28-.22-.08-.1-.15-.2-.2-.3s-.08-.2-.1-.3c-.02-.1-.03-.2-.03-.3 0-.3.1-.58.28-.83.18-.25.42-.45.7-.6.28-.15.6-.23.95-.23.35 0 .68.07.98.22.3.15.56.33.78.55.22.22.4.48.53.78.13.3.2.62.2.97.02.35-.05.7-.22 1.04Z" />
        </svg>
    )
}

function GoogleMapsIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
        </svg>
    )
}

export function RentalCardActions({ rental, status }: RentalCardActionsProps) {
  const { accountId, userAccount } = useAuth();
  const [isFinishing, startFinishTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const { toast } = useToast();
  
  const finishFormRef = useRef<HTMLFormElement>(null);

  const isAdmin = userAccount?.role === 'admin';
  const canEdit = isAdmin || userAccount?.permissions?.canEditRentals;
  const canSeeFinance = isAdmin || userAccount?.permissions?.canAccessFinance;

  const isFinalizeDisabled = !['Ativo', 'Em Atraso', 'Encerra hoje'].includes(status.text);
  const isPendingStatus = status.text === 'Pendente';
  
  const rentalDays = calculateRentalDays(rental.rentalDate, rental.returnDate);
  const totalValue = rental.value * rentalDays;

  const handleFinishAction = (formData: FormData) => {
    startFinishTransition(async () => {
        if (!accountId) return;
        const boundAction = finishRentalAction.bind(null, accountId);
        await boundAction(formData);
        toast({ title: "Sucesso!", description: "Ordem de Serviço finalizada." });
    })
  }

  const handleDeleteAction = () => {
     startDeleteTransition(async () => {
        if (!accountId) return;
        const result = await deleteRentalAction(accountId, rental.id);
        if (result.message === 'error') {
            toast({ title: "Erro", description: result.error, variant: "destructive"});
        } else {
            toast({ title: "Sucesso!", description: "Ordem de Serviço excluída." });
        }
     });
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="space-y-4">
        <div className="flex items-stretch justify-between gap-2">
            <div className="flex items-start gap-3 flex-grow">
                <MapPin className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground">Local de Entrega</span>
                    <span className="font-medium">{rental.deliveryAddress}</span>
                </div>
            </div>
            {!!rental.latitude && !!rental.longitude && (
            <Button variant="outline" size="sm" asChild className="h-auto">
                <Link href={`https://www.google.com/maps?q=${rental.latitude},${rental.longitude}`} target="_blank">
                    <MapPin className="h-4 w-4" />
                    <span>Abrir no Mapa</span>
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
        </div>
        
        {canSeeFinance && (
            <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                    <CircleDollarSign className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                    <div className="flex flex-col">
                        <span className="text-sm text-muted-foreground">Valor Total Previsto ({rentalDays} {rentalDays > 1 ? 'dias' : 'dia'})</span>
                        <span className="font-medium">{formatCurrency(totalValue)}</span>
                    </div>
                </div>
            </div>
        )}
        
        <Separator />
        
        <div className="flex items-center justify-between">
            <a 
                href={`https://wa.me/${formatPhoneNumberForWhatsApp(rental.client?.phone ?? '')}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-green-600 dark:text-green-500 hover:underline"
            >
                <WhatsAppIcon className="h-5 w-5"/>
                <span className="font-medium">{rental.client?.phone}</span>
            </a>
             {canEdit && (
                 <Button asChild variant="link" className="p-0 h-auto text-sm">
                    <Link href={`/rentals/${rental.id}/edit`}>
                        Editar OS
                    </Link>
                 </Button>
             )}
        </div>


      </div>
       <div className="flex w-full items-center gap-2 mt-auto">
            {canEdit && !isPendingStatus && (
                 <AlertDialog>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="shrink-0">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <AlertDialogTrigger asChild>
                                <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Excluir OS
                                </DropdownMenuItem>
                            </AlertDialogTrigger>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <TriangleAlert className="h-6 w-6 text-destructive" />
                            Você tem certeza?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta ação não pode ser desfeita. Isso irá excluir permanentemente o registro desta Ordem de Serviço.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Voltar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteAction} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                            {isDeleting ? <Spinner size="small" /> : 'Sim, Excluir'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}

            {isPendingStatus ? (
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="w-full" disabled={isDeleting}>
                            {isDeleting ? <Spinner size="small" /> : <XCircle />}
                            Cancelar Agendamento
                        </Button>
                    </AlertDialogTrigger>
                     <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                                <TriangleAlert className="h-6 w-6 text-destructive" />
                                Cancelar este Agendamento?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta ação não pode ser desfeita e irá remover permanentemente o registro deste agendamento.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isDeleting}>Voltar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteAction} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                                {isDeleting ? <Spinner size="small" /> : 'Sim, Cancelar'}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            ) : (
                <form ref={finishFormRef} action={handleFinishAction} className="flex-grow">
                    <input type="hidden" name="rentalId" value={rental.id} />
                    <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={isFinishing || isFinalizeDisabled}>
                    {isFinishing ? <Spinner size="small" /> : <CheckCircle />}
                    Finalizar OS
                    </Button>
                </form>
            )}
        </div>
    </div>
  );
}
