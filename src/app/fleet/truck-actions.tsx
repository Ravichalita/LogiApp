
'use client';

import { useState, useTransition } from 'react';
import { deleteTruckAction } from '@/lib/actions';
import { MoreVertical, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
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
import { FleetForm } from './fleet-form';
import type { Truck } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';

export function TruckActions({ truck }: { truck: Truck }) {
  const { accountId, userAccount, isSuperAdmin } = useAuth();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const isRented = truck.status === 'Em Operação';

  const canEdit = isSuperAdmin || userAccount?.permissions?.canEditFleet;
  const canDelete = isSuperAdmin || userAccount?.permissions?.canEditFleet;

  const handleDelete = () => {
    if (!accountId) return;
    startTransition(async () => {
      const result = await deleteTruckAction(accountId, truck.id);
      if (result.message === 'error') {
        toast({
          title: 'Erro ao excluir',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Sucesso',
          description: 'Caminhão excluído.',
        });
        setIsDeleteDialogOpen(false);
      }
    });
  };

  return (
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0 flex-shrink-0">
                <span className="sr-only">Abrir menu</span>
                <MoreVertical className="h-4 w-4" />
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
                <>
                  <DropdownMenuSeparator />
                  <AlertDialogTrigger asChild disabled={isRented}>
                  <DropdownMenuItem 
                      className="text-destructive" 
                      onSelect={(e) => { e.preventDefault(); setIsDeleteDialogOpen(true); }}
                      disabled={isRented}
                  >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir
                  </DropdownMenuItem>
                  </AlertDialogTrigger>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Caminhão</DialogTitle>
               <DialogDescription>
                Ajuste as informações do veículo da sua frota.
              </DialogDescription>
            </DialogHeader>
             <div className="flex-grow overflow-y-auto">
                <FleetForm truck={truck} onSave={() => setIsEditDialogOpen(false)} />
            </div>
          </DialogContent>

          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
              <AlertDialogDescription>
                Essa ação não pode ser desfeita. Isso excluirá permanentemente o caminhão.
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
  );
}
