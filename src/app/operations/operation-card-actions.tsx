

'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { MoreVertical, Edit, Trash2, CheckCircle, Share2, Download, MessageSquare } from 'lucide-react';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import type { PopulatedOperation } from '@/lib/types';
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
import Link from 'next/link';
import { deleteOperationAction, finishOperationAction } from '@/lib/actions';
import { OsPdfDocument } from '@/components/os-pdf-document';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface OperationCardActionsProps {
  operation: PopulatedOperation;
}

export function OperationCardActions({ operation }: OperationCardActionsProps) {
  const { accountId, userAccount } = useAuth();
  const [isFinishing, startFinishTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const { toast } = useToast();
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);


  const isAdmin = userAccount?.role === 'admin' || userAccount?.role === 'owner';
  const isViewer = userAccount?.role === 'viewer';
  const permissions = userAccount?.permissions;

  const canEdit = isAdmin || permissions?.canEditOperations;
  const canDelete = isAdmin || permissions?.canEditOperations;
  const canFinish = isAdmin || isViewer || permissions?.canEditOperations;


  const handleDelete = () => {
    if (!accountId) return;
    startDeleteTransition(async () => {
      const result = await deleteOperationAction(accountId, operation.id);
      if (result?.message === 'error') {
        toast({ title: 'Erro ao excluir', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Sucesso', description: 'Operação excluída.' });
      }
    });
  };

  const handleFinish = () => {
    if (!accountId) return;
    startFinishTransition(async () => {
      const result = await finishOperationAction(accountId, operation.id);
       if (result?.message === 'error') {
        toast({ title: 'Erro ao finalizar', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Sucesso', description: 'Operação finalizada.' });
      }
    });
  };
  
  const handleGenerateAndDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    toast({ title: 'Gerando PDF...', description: 'Aguarde um momento.' });

    const pdfContainer = document.getElementById(`pdf-op-${operation.id}`);
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
        
        const osId = `OP${operation.sequentialId}`;
        pdf.save(`OS_${osId}.pdf`);

    } catch (error) {
        console.error("Error generating PDF:", error);
        toast({ title: "Erro ao gerar PDF", description: "Não foi possível gerar o arquivo.", variant: "destructive" });
    } finally {
        setIsGeneratingPdf(false);
    }
  };

  const acctForLink = operation.accountId || accountId;

  return (
    <>
    <div style={{ position: 'fixed', left: '-2000px', top: 0, zIndex: -1 }}>
        <div id={`pdf-op-${operation.id}`} style={{ width: '210mm', height: '297mm', backgroundColor: 'white' }}>
            <OsPdfDocument item={operation} />
        </div>
    </div>
    <div className="flex w-full items-center gap-2 mt-auto">
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
                    <Link href={`/operations/${operation.id}/edit?account=${encodeURIComponent(acctForLink!)}`}>
                    <Edit className="mr-2 h-4 w-4" />
                    Editar Operação
                    </Link>
                </DropdownMenuItem>
                )}
                {canDelete && (
                <>
                    <DropdownMenuSeparator />
                    <AlertDialogTrigger asChild>
                    <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir Operação
                    </DropdownMenuItem>
                    </AlertDialogTrigger>
                </>
                )}
            </DropdownMenuContent>
            </DropdownMenu>

            <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Excluir esta Operação?</AlertDialogTitle>
                <AlertDialogDescription>
                Esta ação não pode ser desfeita e excluirá permanentemente os dados desta operação.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Voltar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                {isDeleting ? <Spinner size="small" /> : 'Sim, Excluir'}
                </AlertDialogAction>
            </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <div className="flex-grow flex items-center justify-end gap-2">
            {canFinish && (
            <Button
                onClick={handleFinish}
                disabled={isFinishing}
                className="flex-grow bg-accent text-accent-foreground hover:bg-accent/90"
            >
                {isFinishing ? <Spinner size="small" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                Finalizar
            </Button>
            )}
             <Button variant="nooutline" onClick={handleGenerateAndDownloadPdf} disabled={isGeneratingPdf} size="bigicon">
                {isGeneratingPdf ? <Spinner size="small" /> : <Image src="/pdf.svg" alt="PDF Icon" width={26} height={26} />}
            </Button>
      </div>
    </div>
    </>
  );
}
