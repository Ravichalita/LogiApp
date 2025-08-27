
'use client';
import { useState, useTransition } from 'react';
import { deleteClientAction } from '@/lib/actions';
import { getActiveRentalsForUser } from '@/lib/data';
import { MoreHorizontal, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import type { Client, Rental } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { Spinner } from '@/components/ui/spinner';
import Link from 'next/link';

export function ClientActions({ client }: { client: Client }) {
  const { accountId, userAccount } = useAuth();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCheckingRentals, setIsCheckingRentals] = useState(false);
  const [activeRentalsCount, setActiveRentalsCount] = useState(0);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const isAdmin = userAccount?.role === 'admin';
  const canEdit = isAdmin || userAccount?.permissions?.canEditClients;
  const canDelete = isAdmin || userAccount?.permissions?.canEditClients;


  const handleDelete = () => {
    if (!accountId) {
        toast({ title: "Erro", description: "Conta não identificada.", variant: "destructive" });
        return;
    }
    startTransition(async () => {
      const result = await deleteClientAction(accountId, client.id);
      if (result.message === 'error') {
        toast({
          title: 'Erro ao excluir',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Sucesso',
          description: 'Cliente e todos os seus aluguéis foram excluídos.',
        });
        setIsDeleteDialogOpen(false);
      }
    });
  };

  const handleOpenDeleteDialog = async (e: Event) => {
    e.preventDefault();
    if (!accountId) return;

    setIsCheckingRentals(true);
    try {
        const rentals = await getActiveRentalsForUser(accountId, client.id, 'clientId');
        setActiveRentalsCount(rentals.length);
    } catch (error) {
        console.error("Failed to check for active rentals:", error);
        toast({ title: "Erro", description: "Não foi possível verificar os aluguéis do cliente.", variant: "destructive" });
    } finally {
        setIsCheckingRentals(false);
        setIsDeleteDialogOpen(true);
    }
  }


  return (
    <>
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Abrir menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit && (
                <DropdownMenuItem asChild>
                    <Link href={`/clients/${client.id}/edit`}>
                        <Edit className="mr-2 h-4 w-4" />
                        Editar
                    </Link>
                </DropdownMenuItem>
              )}
              {canDelete && (
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem 
                    className="text-destructive" 
                    onSelect={handleOpenDeleteDialog}
                    disabled={isCheckingRentals}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {isCheckingRentals ? 'Verificando...' : 'Excluir'}
                  </DropdownMenuItem>
                </AlertDialogTrigger>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Delete Alert Dialog */}
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
              <AlertDialogDescription>
                Essa ação não pode ser desfeita. Isso excluirá permanentemente o cliente.
                {activeRentalsCount > 0 && (
                    <span className="font-bold text-destructive block mt-2">
                        Atenção: Este cliente tem {activeRentalsCount} aluguel(s) ativo(s) que também serão permanentemente excluídos.
                    </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={isPending} className="bg-destructive hover:bg-destructive/90">
                {isPending ? 'Excluindo...' : 'Excluir'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </>
  );
}
