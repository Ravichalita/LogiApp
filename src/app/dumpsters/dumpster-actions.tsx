
'use client';
import { useState, useTransition } from 'react';
import { deleteDumpsterAction, updateDumpsterStatusAction } from '@/lib/actions';
import { MoreVertical, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
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
import type { DumpsterStatus, EnhancedDumpster } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';

export function MaintenanceCheckbox({ dumpster, isPending, handleToggleStatus, isReservedOrRented }: {
    dumpster: EnhancedDumpster;
    isPending: boolean;
    handleToggleStatus: () => void;
    isReservedOrRented: boolean;
}) {
    const isMaintenance = dumpster.status === 'Em Manutenção';
    const { userAccount } = useAuth();
    const canEdit = userAccount?.role === 'admin' || userAccount?.permissions?.canEditDumpsters;


    return (
        <div className="flex items-center space-x-2">
            <Checkbox 
                id={`maintenance-${dumpster.id}`} 
                checked={isMaintenance}
                onCheckedChange={handleToggleStatus}
                disabled={isPending || isReservedOrRented || !canEdit}
                aria-label="Marcar como em manutenção"
            />
            <Label 
                htmlFor={`maintenance-${dumpster.id}`}
                className={cn(
                    "text-sm font-medium leading-none",
                    (isPending || isReservedOrRented || !canEdit) && "text-muted-foreground cursor-not-allowed"
                )}
            >
                Em Manutenção
            </Label>
        </div>
    )
}

export function DumpsterOptionsMenu({ dumpster }: { dumpster: EnhancedDumpster }) {
  const { accountId, userAccount } = useAuth();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const isReserved = dumpster.derivedStatus.startsWith('Reservada');
  const isRented = dumpster.derivedStatus === 'Alugada';
  
  const isAdmin = userAccount?.role === 'admin';
  const canEdit = isAdmin || userAccount?.permissions?.canEditDumpsters;
  const canDelete = isAdmin || userAccount?.permissions?.canEditDumpsters;

  const handleDelete = () => {
    if (!accountId) return;
    startTransition(async () => {
      const result = await deleteDumpsterAction(accountId, dumpster.id);
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
                  <AlertDialogTrigger asChild disabled={isRented || isReserved}>
                  <DropdownMenuItem 
                      className="text-destructive" 
                      onSelect={(e) => { e.preventDefault(); setIsDeleteDialogOpen(true); }}
                      disabled={isRented || isReserved}
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
  );
}


export function DumpsterActions({ dumpster }: { dumpster: EnhancedDumpster }) {
  const { accountId } = useAuth();
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  
  const isReserved = dumpster.derivedStatus.startsWith('Reservada');
  const isRented = dumpster.derivedStatus === 'Alugada';
  
  const getStatusVariant = (status: EnhancedDumpster['derivedStatus']): 'default' | 'destructive' | 'secondary' | 'success' => {
    if (status.startsWith('Reservada')) return 'secondary';
    switch (status) {
      case 'Disponível':
        return 'success';
      case 'Alugada':
        return 'destructive';
      case 'Em Manutenção':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const handleToggleStatus = () => {
    if (!accountId || isRented || isReserved) return;
    const newStatus = dumpster.status === 'Disponível' ? 'Em Manutenção' : 'Disponível';
    
    startTransition(async () => {
        const result = await updateDumpsterStatusAction(accountId, dumpster.id, newStatus);
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
      <div className="flex items-center justify-end gap-2 md:gap-4">
        <Badge
          variant={getStatusVariant(dumpster.derivedStatus)}
          className={cn('text-xs text-center', isPending && 'opacity-50')}
        >
          {dumpster.derivedStatus}
        </Badge>
        
        <div className="hidden md:flex">
             <MaintenanceCheckbox 
                dumpster={dumpster} 
                isPending={isPending} 
                handleToggleStatus={handleToggleStatus} 
                isReservedOrRented={isRented || isReserved}
            />
        </div>
        <div className="hidden md:block">
            <DumpsterOptionsMenu dumpster={dumpster} />
        </div>
      </div>
  );
}
