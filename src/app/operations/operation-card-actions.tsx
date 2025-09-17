
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
import { deleteOperationAction } from '@/lib/actions';
import { OsPdfDocument } from '@/components/os-pdf-document';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Separator } from '@/components/ui/separator';
import { FileText, DollarSign, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

interface OperationCardActionsProps {
  operation: PopulatedOperation;
}

export function OperationCardActions({ operation }: OperationCardActionsProps) {
  const { accountId, userAccount, isSuperAdmin } = useAuth();
  const [isDeleting, startDeleteTransition] = useTransition();
  const { toast } = useToast();

  const canEdit = isSuperAdmin || userAccount?.permissions?.canEditOperations;

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

  return (
    <AlertDialog>
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-5 w-5" />
                    <span className="sr-only">Ações</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                 {canEdit && (
                    <DropdownMenuItem asChild>
                        <Link href={`/operations/${operation.id}/edit`}>
                            <Edit className="mr-2 h-4 w-4" />
                            Editar OS
                        </Link>
                    </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <AlertDialogTrigger asChild>
                    <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()} disabled={!canEdit}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir OS
                    </DropdownMenuItem>
                </AlertDialogTrigger>
            </DropdownMenuContent>
        </DropdownMenu>

        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Excluir Operação?</AlertDialogTitle>
                <AlertDialogDescription>
                    Esta ação não pode ser desfeita. A operação #{operation.sequentialId} será permanentemente excluída.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                    {isDeleting ? <Spinner size="small" /> : 'Sim, Excluir'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
  );
}
