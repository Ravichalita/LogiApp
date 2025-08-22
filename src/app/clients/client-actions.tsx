
'use client';
import { useState, useTransition } from 'react';
import { deleteClientAction } from '@/lib/actions';
import { MoreHorizontal, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { EditClientForm } from './edit-client-form';
import type { Client } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';

export function ClientActions({ client }: { client: Client }) {
  const { accountId, userAccount } = useAuth();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const isAdmin = userAccount?.role === 'admin';
  const canEdit = isAdmin || userAccount?.permissions?.canEditClients;
  const canDelete = isAdmin || userAccount?.permissions?.canDeleteItems;


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
          description: 'Cliente excluído.',
        });
        setIsDeleteDialogOpen(false);
      }
    });
  };

  return (
    <>
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
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
                <DialogTrigger asChild>
                  <DropdownMenuItem onSelect={() => setIsEditDialogOpen(true)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Editar
                    </DropdownMenuItem>
                </DialogTrigger>
              )}
              {canDelete && (
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem className="text-destructive" onSelect={(e) => { e.preventDefault(); setIsDeleteDialogOpen(true);}}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir
                  </DropdownMenuItem>
                </AlertDialogTrigger>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Edit Dialog */}
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Cliente</DialogTitle>
            </DialogHeader>
            <EditClientForm client={client} onSave={() => setIsEditDialogOpen(false)} />
          </DialogContent>

          {/* Delete Alert Dialog */}
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
              <AlertDialogDescription>
                Essa ação não pode ser desfeita. Isso excluirá permanentemente o cliente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={isPending} className="bg-destructive hover:bg-destructive/90">
                {isPending ? 'Excluindo...' : 'Excluir'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Dialog>
    </>
  );
}
