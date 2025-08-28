
'use client';

import { useState, useTransition, useRef } from 'react';
import { finishRentalAction, deleteRentalAction } from '@/lib/actions';
import type { PopulatedRental } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { CheckCircle, MapPin, Edit, Trash2, TriangleAlert, CircleDollarSign, CalendarDays, MoreVertical, XCircle } from 'lucide-react';
import { format, differenceInCalendarDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';

import type { getRentalStatus } from '../page';
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
import { cn } from '@/lib/utils';

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

const WhatsAppIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 24 24" 
        {...props}
    >
        <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.77.46 3.44 1.34 4.9l-1.39 5.09 5.21-1.38c1.37.81 2.94 1.23 4.57 1.23h.01c5.46 0 9.91-4.45 9.91-9.92 0-5.46-4.45-9.91-9.91-9.91zM17.5 14.3c-.28-.14-1.65-.82-1.9-.96-.25-.14-.44-.24-.62.24-.18.48-.72.96-.88 1.15-.16.2-.32.22-.6.08-.28-.14-1.18-.43-2.25-1.39-.83-.75-1.39-1.67-1.55-1.96-.16-.29-.01-.45.13-.58.13-.12.28-.31.42-.46.14-.15.18-.25.28-.41.09-.17.05-.31-.02-.45l-.62-1.5c-.24-.58-.5-.63-.68-.64-.17-.01-.36 0-.53 0-.17 0-.44.08-.68.31-.24.24-.92.9-1.12 2.12-.2 1.22.25 2.52.53 2.8.28.28 1.8 2.8 4.36 4.02l.01.01c.25.12.5.24.76.35.33.15.65.25.99.35.8.23 1.63.18 2.2-.14.63-.35 1.08-.94 1.23-1.5.15-.56.15-1.04.1-1.22s-.18-.29-.36-.42z" fill="currentColor" />
    </svg>
);


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
                <Button variant="outline" size="sm" asChild className="flex flex-col items-center justify-center p-2 h-auto w-[65%] text-center md:flex-row md:w-auto md:h-auto md:p-2 md:text-sm">
                    <Link href={`https://www.google.com/maps?q=${rental.latitude},${rental.longitude}`} target="_blank">
                        <MapPin className="h-5 w-5 mb-1 md:mb-0 md:mr-2" />
                        <span className="leading-tight text-[10px] md:text-xs">Abrir no Mapa</span>
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
                <WhatsAppIcon className="h-6 w-6" />
                <span className="font-medium">{rental.client?.phone}</span>
            </a>
        </div>


      </div>
       <div className="flex w-full items-center gap-2 mt-auto">
            <div className="flex-grow-0">
                <AlertDialog>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                            {canEdit && (
                                <DropdownMenuItem asChild>
                                    <Link href={`/rentals/${rental.id}/edit`}>
                                        <Edit className="mr-2 h-4 w-4" />
                                        Editar OS
                                    </Link>
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                             <AlertDialogTrigger asChild>
                                <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}>
                                     <Trash2 className="mr-2 h-4 w-4" />
                                     {isPendingStatus ? 'Cancelar Agendamento' : 'Excluir OS'}
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
            </div>
            {isPendingStatus ? (
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button className="w-full text-destructive border-destructive hover:bg-destructive/10 hover:text-destructive" variant="outline" disabled={isDeleting}>
                            <XCircle className="mr-2 h-4 w-4" />
                            Cancelar Agendamento
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                                <TriangleAlert className="h-6 w-6 text-destructive" />
                                Cancelar Agendamento?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta ação irá excluir permanentemente esta Ordem de Serviço. Deseja continuar?
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
                        {isFinishing ? <Spinner size="small" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                        Finalizar OS
                    </Button>
                </form>
            )}
        </div>
    </div>
  );
}
