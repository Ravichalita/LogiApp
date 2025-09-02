
'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { MoreVertical, Edit, Trash2, CheckCircle } from 'lucide-react';
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

interface OperationCardActionsProps {
  operation: PopulatedOperation;
}

export function OperationCardActions({ operation }: OperationCardActionsProps) {
  const { accountId, userAccount } = useAuth();
  const [isFinishing, startFinishTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const { toast } = useToast();

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
  
  const acctForLink = operation.accountId || accountId;

  return (
    <div className="flex w-full items-center gap-2 mt-auto">
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

      {canFinish && (
        <Button
          onClick={handleFinish}
          disabled={isFinishing}
          className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
        >
          {isFinishing ? <Spinner size="small" /> : <CheckCircle className="mr-2 h-4 w-4" />}
          Finalizar Operação
        </Button>
      )}
    </div>
  );
}
