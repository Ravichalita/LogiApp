
'use client';

import { useState, useTransition } from 'react';
import { deleteSelfUserAction } from '@/lib/actions';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
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
import { Trash2 } from 'lucide-react';

export function DeleteSelfAccountButton() {
  const { accountId, user, logout } = useAuth();
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleDelete = () => {
    if (!accountId || !user) return;

    startTransition(async () => {
      const result = await deleteSelfUserAction(accountId, user.uid);
      if (result.message === 'error') {
        toast({
          title: 'Erro ao encerrar a conta',
          description: result.error,
          variant: 'destructive',
        });
        setIsDialogOpen(false);
      } else {
        toast({
          title: 'Conta Encerrada',
          description: 'Sua conta foi excluída com sucesso.',
        });
        // Log out after successful deletion
        await logout();
      }
    });
  };

  return (
       <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <AlertDialogTrigger asChild>
                <Button
                    variant="destructive"
                    onClick={() => setIsDialogOpen(true)}
                >
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span className="md:hidden">Encerrar Conta</span>
                    <span className="hidden md:inline">Encerrar Minha Conta Permanentemente</span>
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                <AlertDialogDescription>
                    Esta ação não pode ser desfeita. Isso excluirá permanentemente sua conta e removerá seu acesso a esta organização.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={isPending} className="bg-destructive hover:bg-destructive/90">
                    {isPending ? <Spinner size="small" /> : 'Sim, encerrar minha conta'}
                </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
       </AlertDialog>
  );
}
