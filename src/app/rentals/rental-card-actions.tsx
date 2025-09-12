
'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { finishRentalAction, deleteRentalAction, updateRentalAction } from '@/lib/actions';
import type { PopulatedRental, Attachment, Account } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { CheckCircle, MapPin, Edit, Trash2, TriangleAlert, CircleDollarSign, CalendarDays, MoreVertical, XCircle, FileText, Hash, Share2, MessageSquare, Route, Clock, Sun, CloudRain, Cloudy, Snowflake, Map as MapIcon, DollarSign, MapPinned } from 'lucide-react';
import Image from 'next/image';
import { format, differenceInCalendarDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import type { getRentalStatus } from '../os/page';
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Spinner } from '@/components/ui/spinner';
import { Separator } from '@/components/ui/separator';
import { AttachmentsUploader } from '@/components/attachments-uploader';
import { OsPdfDocument } from '@/components/os-pdf-document';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { fetchAccount } from '@/lib/data';


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
        viewBox="0 0 20 20"
        className="cls-1"
        {...props}
    >
      <path d="M10.01,0C4.5,0,.02,4.44,.02,9.92c0,1.77.47,3.5,1.37,5.01l-1.39,5.07,5.2-1.39h0c1.47.8,3.12,1.23,4.81,1.23,5.52,0,9.99-4.44,9.99-9.92S15.53,0,10.01,0ZM10.01,18.21c-1.69,0-3.26-.5-4.57-1.35l-3.11.83.83-3.03h0c-.95-1.35-1.5-2.98-1.5-4.75C1.66,5.34,5.4,1.63,10.01,1.63s8.35,3.71,8.35,8.29-3.74,8.29-8.35,8.29Z"/>
      <path d="M5.39,9.36c-.71-1.36-.65-2.83.51-3.83.46-.44,1.36-.4,1.62.16l.8,1.92c.1.21.09.42-.06.63-.19.22-.37.44-.56.66-.15.17-.22.31-.08.48.76,1.28,1.86,2.32,3.42,2.98.23.09.39.07.55-.12.24-.29.48-.59.72-.88.2-.26.39-.29.68-.17.66.31,1.98.94,1.98.94.49.37-.19,1.8-.79,2.16-.87.51-1.46.43-2.37.25-2.97-.59-5.28-3.13-6.43-5.18h0Z"/>
    </svg>
);


export function RentalCardActions({ rental, status }: RentalCardActionsProps) {
  const { accountId, userAccount, isSuperAdmin } = useAuth();
  const [isFinishing, startFinishTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isUpdatingAttachments, startAttachmentTransition] = useTransition();
  const { toast } = useToast();
  const [attachments, setAttachments] = useState<Attachment[]>(rental.attachments || []);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);

  useEffect(() => {
    if (accountId) {
      fetchAccount(accountId).then(setAccount);
    }
  }, [accountId]);


  const permissions = userAccount?.permissions;
  const canEdit = isSuperAdmin || permissions?.canEditRentals;
  const canDelete = isSuperAdmin || permissions?.canEditRentals;
  const canSeeFinance = isSuperAdmin || userAccount?.role === 'owner' || permissions?.canAccessFinance;
  const canUseAttachments = isSuperAdmin || permissions?.canUseAttachments;

  const isFinalizeDisabled = !['Ativo', 'Em Atraso', 'Encerra hoje'].includes(status.text);
  const isPendingStatus = status.text === 'Pendente';
  
  const rentalDays = calculateRentalDays(rental.rentalDate, rental.returnDate);
  const totalValue = rental.billingType === 'lumpSum' ? (rental.lumpSumValue || 0) : rental.value * rentalDays;

  const handleAttachmentUploaded = (newAttachment: Attachment) => {
    const updatedAttachments = [...attachments, newAttachment];
    setAttachments(updatedAttachments);
    
    // Create a FormData object and call the server action to save the new attachment list
    const formData = new FormData();
    formData.set('id', rental.id);
    formData.set('attachments', JSON.stringify(updatedAttachments));
    
    startAttachmentTransition(async () => {
        if (!accountId) return;
        const result = await updateRentalAction(accountId, null, formData);
        if (result?.message === 'error' || result?.errors) {
            toast({ title: "Erro ao salvar anexo", description: result.error || 'Ocorreu um erro.', variant: "destructive"});
            // Revert state on failure
            setAttachments(attachments);
        } else {
            toast({ title: "Anexo salvo!" });
        }
    });
  };

  const handleRemoveAttachment = (attachmentToRemove: Attachment) => {
    // This requires a server action to be truly effective (delete from storage)
    // For now, it just removes from the local state to be saved.
    setAttachments(prev => prev.filter(att => att.url !== attachmentToRemove.url));
  };


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
  
  const handleGenerateAndDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    toast({ title: 'Gerando PDF...', description: 'Aguarde um momento.' });

    const pdfContainer = document.getElementById(`pdf-al-${rental.id}`);
    if (!pdfContainer) {
        console.error("PDF container not found");
        setIsGeneratingPdf(false);
        toast({ title: "Erro", description: "Não foi possível encontrar o container para gerar o PDF.", variant: "destructive" });
        return;
    }

    try {
        const canvas = await html2canvas(pdfContainer, { scale: 2 });
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(canvas, 'PNG', 0, 0, pdfWidth, pdfHeight);
        
        const osId = `AL${rental.sequentialId}`;
        pdf.save(`OS_Aluguel_${osId}.pdf`);

    } catch (error) {
        console.error("Error generating PDF:", error);
        toast({ title: "Erro ao gerar PDF", description: "Não foi possível gerar o arquivo.", variant: "destructive" });
    } finally {
        setIsGeneratingPdf(false);
    }
  };

  const boundFinishRentalAction = finishRentalAction.bind(null, accountId!);
  const attachmentCount = attachments.length;

  return (
    <>
     <div style={{ position: 'fixed', left: '-2000px', top: 0, zIndex: -1 }}>
        <div id={`pdf-al-${rental.id}`} style={{ width: '210mm', height: '297mm', backgroundColor: 'white' }}>
            <OsPdfDocument item={rental} />
        </div>
      </div>
      <div className="flex flex-col gap-4 h-full px-1">
        <div className="space-y-4">
           <div className="space-y-2">
                <div className="flex justify-between items-start gap-2">
                     <div className="flex-grow">
                        <p className="text-sm text-muted-foreground">Local de Entrega:</p>
                        <p className="font-medium">{rental.deliveryAddress}</p>
                    </div>
                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(rental.deliveryAddress)}`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center p-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors shrink-0">
                        <MapPinned className="h-5 w-5" />
                        <span className="text-[10px] font-bold">GPS</span>
                    </a>
                </div>
                 <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="start-address" className="border-none">
                        <AccordionTrigger className="text-xs text-primary hover:no-underline p-0 justify-start [&>svg]:ml-1 data-[state=closed]:text-muted-foreground">
                            <span className="font-normal">Mostrar endereço de partida</span>
                        </AccordionTrigger>
                        <AccordionContent className="pt-2">
                                <div className="flex items-center gap-2 text-sm">
                                <span className="font-semibold uppercase text-xs">Saída:</span>
                                <span>{rental.startAddress}</span>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>

          <div className="space-y-2">
              <div>
                <span className="text-sm text-muted-foreground">Período</span>
                <p className="font-semibold text-base whitespace-nowrap">
                    {format(parseISO(rental.rentalDate), "dd/MM/yy", { locale: ptBR })} - {format(parseISO(rental.returnDate), "dd/MM/yy", { locale: ptBR })}
                </p>
              </div>
          </div>

          {canSeeFinance && (
            <div className="space-y-2">
                <div>
                  <span className="text-sm text-muted-foreground">
                    {rental.billingType === 'lumpSum' ? 'Valor da Empreitada' : `Valor Total Previsto (${rentalDays} ${rentalDays > 1 ? 'dias' : 'dia'})`}
                  </span>
                  <p className="font-medium">{formatCurrency(totalValue)}</p>
                </div>
            </div>
          )}

          {rental.observations && (
              <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                  <div className="flex flex-col">
                  <span className="text-sm text-muted-foreground">Observações</span>
                  <p className="font-medium whitespace-pre-wrap">{rental.observations}</p>
                  </div>
              </div>
          )}
          
          <Separator />

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="attachments" className="border-none">
               <div className="pt-2 flex justify-between items-center w-full">
                  {rental.client?.phone && (
                      <a 
                          href={`https://wa.me/${formatPhoneNumberForWhatsApp(rental.client.phone)}?text=Olá, ${rental.client.name}! Somos da equipe LogiApp, sobre a OS AL${rental.sequentialId}.`}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 hover:underline"
                      >
                          <WhatsAppIcon className="h-6 w-6 fill-green-600" />
                          <span className="font-medium text-green-600">{rental.client.phone}</span>
                      </a>
                  )}
                  {canUseAttachments && (
                    <AccordionTrigger className="text-sm text-primary hover:underline p-0 justify-end [&>svg]:ml-1">
                      ({attachmentCount}) Anexos
                    </AccordionTrigger>
                  )}
              </div>
              {canUseAttachments && (
                <AccordionContent className="pt-4">
                    {accountId && (
                        <AttachmentsUploader
                            accountId={accountId}
                            attachments={attachments || []}
                            onAttachmentUploaded={handleAttachmentUploaded}
                            onAttachmentDeleted={handleRemoveAttachment}
                            uploadPath={`accounts/${accountId}/rentals/${rental.id}/attachments`}
                            showDeleteButton={false}
                            showLabel={false}
                        />
                    )}
                </AccordionContent>
              )}
            </AccordionItem>
          </Accordion>


        </div>
        <div className="flex w-full items-center gap-2 mt-auto pt-4">
            <AlertDialog>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="nooutline" size="bigicon">
                            <MoreVertical className="h-6 w-6" />
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
                        {canDelete && !isPendingStatus && (
                            <>
                            <DropdownMenuSeparator />
                            <AlertDialogTrigger asChild>
                                <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Excluir OS
                                </DropdownMenuItem>
                            </AlertDialogTrigger>
                            </>
                        )}
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
            
            <div className="flex-grow flex items-center gap-2">
                {isPendingStatus ? (
                    canDelete && (
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
                                        {isDeleting ? 'Removendo...' : 'Sim, Cancelar'}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )
                ) : (
                    <form action={boundFinishRentalAction} className="flex-grow">
                        <input type="hidden" name="rentalId" value={rental.id} />
                        <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={isFinishing || isFinalizeDisabled}>
                            {isFinishing ? <Spinner size="small" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                            Finalizar
                        </Button>
                    </form>
                )}
                
                <Button variant="nooutline" onClick={handleGenerateAndDownloadPdf} disabled={isGeneratingPdf} className="px-2 md:px-4">
                    {isGeneratingPdf ? <Spinner size="small" /> : <Image src="/pdf.svg" alt="PDF Icon" width={26} height={26} />}
                </Button>
            </div>
        </div>
      </div>
    </>
  );
}
