
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
                <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoA2AAdVgAAAFsSURBVHic7dXhUQMxGIXhH6kESqAESqAESqAESqAESqAESqAEUqAEYgN2s/3zN5Nch+zM3S13k/zD/Jk1yfF/+b5O5O/vj+AD8BGYA/9tW8wI/AT+A+cdeD7gUfAG/AL+AY8L3g8wV2B7wXvA3YV/Be8F9xZ8G/ht4Z+Ffxz8y+C/A38z/F8B/4d/Gvzr4F8H/zr4N8D/Ffy/gH8Z/Gvg3wJ/C/xb4L8F/gHwL4B/APz74H8F/CvgnwR/EvyT4D8G/yT4H8F/BP8h+J/BPwv+C/BPwX8G/gr8L/C/wv8q/Gvwr8K/Cv5V8a/Gvxb8a/Gvxr8W/Gvxb8e/Fvzb8e/Fvzb8W/Bvwb8G/hvwb8G/Bv4b8G/hv4L/FfyX4L+C/xL8l+C/hP8S/JfkvwX/JfkvwX8J/kvw34L/Fvy34L8F/y3478F/D/578N+D/x789+C/B/89+O/Bfw/+e/Dfg/8e/Pfgvwf/PfjvwX8P/nvw34P/Hvz34L8H/z3478F/D/578N+D/x789+C/B/89+O/Bfw/+e/Dfg/8e/Pfgvwf/PfjvwX8P/nvw34P/Hvz34L8H/z3478F/D/578N+D/x789+C/B/89+O/Bfw/+e/Dfg/8e/Pfgvwf/PfjvwX8P/nvw34P/Hvz34L8H/z3478F/D/578N+D/x789+C/B/89+O/Bfw/+e/Dfg/8e/Pfgvwf/PfjvwX8P/nvw34P/Hvz34L8H/z3478F/D/578N+D/x789+C/B/89+O/Bfw/+e/Dfg/8e/Pfgvwf/PfjvwX8P/nvw34P/Hvz34L8H/z3478F/D/578N+D/x789+C/B/89+O/Bfw/+e/Dfg/8e/Pfgvwf/PfjvwX8P/nvw34P/Hvz34L8H/z3478F/D/578N+D/x789+C/B/89+O/Bfw/+e/Dfg/8e/Pfgvwf/PfjvwX8P/nvw34P/Hvz34L8H/z3478F/D/578N+D/x789+C/B/89+O/Bfw/+e/Dfg/8e/Pfgvwf/PfjvwX8P/nvw34P/Hvz34L8H/z3478F/D/578N+D/x789+C/B/89+O/Bfw/+e/Dfg/8e/Pfgvwf/PfjvwX8P/nvw34P/Hvz34L8H/z3478F/D/578N+D/x789+C/B/89+O/Bfw/+e/Dfg/8e/Pfgvwf/PfjvwX8P/nvw34P/Hvz34L8H/z3478F/D/578N+D/x789+C/B/89+O/Bfw/+e/Dfg/8e/Pfgvwf/PfjvwX8P/nvw34P/Hvz34L8H/z3478F/D/578N+D/x789+C/B/89+O/Bfw/+e/Dfg/8e/Pfgvwf/PfjvwX8P/nvw34L/Hvz34L8H/z3478F/D/578N+D/x789+C/B/89+O/Bfw/+e/Dfg/8e/Pfgvwf/PfjvwX8P/nvw34P/Hvz34L8H/z3478F/D/578N+D/x789+C/B/89+O/Bfw/+e/Dfg/8e/Pfgvwf/PfjvwX8P/nvw34P/Hvz34L8H/z3478F/D/578N+D/x789+C/B/89+O/Bfw/+e/Dfg/8e/Pfgvwf/PfjvwX8P/nvw34P/Hvz34L8H/z347sP/AH8F/l1931EAAAAASUVORK5CYII=" alt="WhatsApp Icon" className="h-10 w-10" />
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
