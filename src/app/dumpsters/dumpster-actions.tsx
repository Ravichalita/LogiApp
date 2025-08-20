'use client';
import { useState, useTransition } from 'react';
import { deleteDumpster, updateDumpsterStatus } from '@/lib/actions';
import { MoreHorizontal, Trash2, Edit } from 'lucide-react';
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
import { EditDumpsterForm } from './edit-dumpster-form';
import type { Dumpster, DumpsterStatus } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';

export function DumpsterActions({ dumpster }: { dumpster: Dumpster }) {
  const { user } = useAuth();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const getStatusVariant = (status: DumpsterStatus): 'default' | 'destructive' | 'secondary' => {
    switch (status) {
      case 'Disponível':
        return 'default';
      case 'Alugada':
        return 'destructive';
      case 'Em Manutenção':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const handleDelete = () => {
    if (!user) return;
    startTransition(async () => {
      const result = await deleteDumpster(user.uid, dumpster.id);
      if (result.message === 'error') {
        toast({
          title: 'Erro ao excluir',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Sucesso',
          description: 'Caçamba excluída.',
        });
        setIsDeleteDialogOpen(false);
      }
    });
  };

  const handleChangeStatus = (newStatus: DumpsterStatus) => {
    if (dumpster.status === newStatus || !user) return;
    startTransition(async () => {
        const result = await updateDumpsterStatus(user.uid, dumpster.id, newStatus);
        if (result.message === 'error') {
             toast({
                title: 'Erro',
                description: result.error,
                variant: 'destructive',
            });
        } else {
            toast({
                title: 'Sucesso',
                description: `Status da caçamba alterado para ${newStatus}.`
            });
        }
    });
  };

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        {/* Status Badge Dropdown */}
        <DropdownMenu open={isStatusMenuOpen} onOpenChange={setIsStatusMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Badge
              variant={getStatusVariant(dumpster.status)}
              className={cn('capitalize cursor-pointer')}
            >
              {dumpster.status}
            </Badge>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
             {(['Disponível', 'Alugada', 'Em Manutenção'] as DumpsterStatus[]).map((status) => (
                <DropdownMenuItem key={status} onSelect={() => handleChangeStatus(status)} disabled={isPending || dumpster.status === status}>
                    {isPending && dumpster.status !== status ? 'Aguarde...' : status}
                </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Actions Kebab Menu */}
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
                <DialogTrigger asChild>
                  <DropdownMenuItem onSelect={() => setIsEditDialogOpen(true)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Editar
                  </DropdownMenuItem>
                </DialogTrigger>
                <DropdownMenuSeparator />
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem className="text-destructive" onSelect={(e) => { e.preventDefault(); setIsDeleteDialogOpen(true); }}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir
                  </DropdownMenuItem>
                </AlertDialogTrigger>
              </DropdownMenuContent>
            </DropdownMenu>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar Caçamba</DialogTitle>
              </DialogHeader>
              <EditDumpsterForm dumpster={dumpster} onSave={() => setIsEditDialogOpen(false)} />
            </DialogContent>

            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                <AlertDialogDescription>
                  Essa ação não pode ser desfeita. Isso excluirá permanentemente a caçamba.
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
      </div>
    </>
  );
}
