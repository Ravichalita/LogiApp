
'use client';

import { useState, useTransition } from 'react';
import { MoreHorizontal, Trash2, UserX, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import type { AdminClientView } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { updateUserStatusAction, deleteClientAccountAction } from '@/lib/actions';
import { Spinner } from '@/components/ui/spinner';

export function AdminClientActions({ client }: { client: AdminClientView }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSubmitting, startTransition] = useTransition();
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const { toast } = useToast();

  const handleStatusToggle = () => {
    startTransition(async () => {
      const newStatus = client.ownerStatus === 'ativo'; // This is the new 'disabled' state for the user
      const result = await updateUserStatusAction(client.ownerId, newStatus);
      if (result?.message === 'error') {
        toast({ title: 'Erro', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Sucesso', description: `Acesso de ${client.ownerName} foi ${newStatus ? 'desativado' : 'reativado'}.` });
        setIsMenuOpen(false);
      }
    });
  };
  
  const handleDeleteClient = () => {
    startTransition(async () => {
      const result = await deleteClientAccountAction(client.accountId, client.ownerId);
       if (result?.message === 'error') {
        toast({ title: 'Erro ao excluir', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Sucesso', description: `A conta de ${client.ownerName} e todos os seus dados foram excluídos.` });
        setIsAlertOpen(false);
      }
    });
  };


  return (
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Abrir menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Ações</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleStatusToggle} disabled={isSubmitting}>
              {client.ownerStatus === 'ativo' ? (
                <><UserX className="mr-2 h-4 w-4" /> Desativar Acesso</>
              ) : (
                <><ToggleRight className="mr-2 h-4 w-4" /> Reativar Acesso</>
              )}
            </DropdownMenuItem>
             <AlertDialogTrigger asChild>
                <DropdownMenuItem className="text-destructive" onSelect={(e) => { e.preventDefault(); setIsAlertOpen(true);}}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir Conta
                </DropdownMenuItem>
            </AlertDialogTrigger>
          </DropdownMenuContent>
        </DropdownMenu>

        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. Isso excluirá permanentemente a conta de <span className="font-bold">{client.ownerName}</span> e todos os seus dados, incluindo caçambas, clientes e aluguéis.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteClient} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">
              {isSubmitting ? <Spinner size="small" /> : 'Sim, excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
  );
}
