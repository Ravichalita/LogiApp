
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
            <path
                fillRule="evenodd"
                d="M18.423 5.577a9.846 9.846 0 0 0-13.926 0A9.846 9.846 0 0 0 2 12c0 1.892.532 3.705 1.487 5.245L2.01 22l4.914-1.474a9.803 9.803 0 0 0 5.076 1.343h.01a9.846 9.846 0 0 0 9.846-9.846 9.846 9.846 0 0 0-3.423-7.445"
                clipRule="evenodd"
                fill="#25D366"
            ></path>
            <path
                fillRule="evenodd"
                d="M12.009 2.13A9.863 9.863 0 0 0 2.14 12.008c0 1.892.532 3.705 1.487 5.245L2.15 21.9l4.914-1.474a9.803 9.803 0 0 0 5.076 1.343h.01a9.846 9.846 0 0 0 9.846-9.846A9.846 9.846 0 0 0 12.01 2.13h-.001zm0 1.563a8.283 8.283 0 0 1 8.283 8.282 8.283 8.283 0 0 1-8.283 8.283h-.009a8.23 8.23 0 0 1-4.274-1.18l-.305-.18-3.17 1.056 1.074-3.08-.198-.32a8.283 8.283 0 0 1-1.274-4.48c0-4.573 3.71-8.282 8.283-8.282z"
                clipRule="evenodd"
                fill="#FEFEFE"
            ></path>
            <path
                fillRule="evenodd"
                d="M9.462 7.735c-.135-.688-.853-.61-1.02-.61-.33 0-.74.332-1.018.61s-1.018 1.154-1.018 2.376c0 1.22.61 2.443 1.018 2.85.408.408 1.087 1.325 2.85 2.443 2.185 1.393 2.92 1.22 3.328 1.087.408-.135.952-.61 1.087-1.018.135-.408.135-.886 0-1.018-.135-.135-.27-.27-.61-.408s-1.018-.54-1.153-.61c-.135-.067-.338-.067-.54.202s-.408.54-.54.675c-.135.135-.27.135-.408 0-.135-.135-.61-.27-.95-.54-.816-.54-1.49-1.22-1.625-1.42s-.068-.337.135-.54c.203-.203.408-.408.54-.54.135-.135.203-.27.27-.408s0-.27-.135-.408c-.135-.135-.745-1.83-.952-2.377z"
                clipRule="evenodd"
                fill="#FEFEFE"
            ></path>
        </svg>
    );
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
                <WhatsAppIcon className="h-7 w-7"/>
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
                        <Button className="w-full" variant="destructive" disabled={isDeleting}>
                            <XCircle />
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
                        {isFinishing ? <Spinner size="small" /> : <CheckCircle />}
                        Finalizar OS
                    </Button>
                </form>
            )}
        </div>
    </div>
  );
}
