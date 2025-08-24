
'use client';

import { useState, useTransition } from 'react';
import { resetAllDataAction, resetFinancialDataAction } from '@/lib/actions';
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

export function ResetAllDataButton({ accountId }: { accountId: string }) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleReset = () => {
    startTransition(async () => {
      const result = await resetAllDataAction(accountId);
      if (result.message === 'error') {
        toast({
          title: 'Erro ao zerar dados',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Sucesso!',
          description: 'Todos os dados da conta foram zerados.',
        });
        setIsDialogOpen(false);
      }
    });
  };

  return (
       <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <AlertDialogTrigger asChild>
                <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    onClick={() => setIsDialogOpen(true)}
                >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Zerar Todos os Dados
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                <AlertDialogDescription>
                    Essa ação não pode ser desfeita. Isso excluirá permanentemente todos os aluguéis (ativos e finalizados), clientes e caçambas. Os dados de usuário e equipe não serão afetados.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset} disabled={isPending} className="bg-destructive hover:bg-destructive/90">
                    {isPending ? <Spinner size="small" /> : 'Sim, zerar dados'}
                </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
       </AlertDialog>
  );
}

export function ResetFinancialDataButton({ accountId }: { accountId: string }) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleReset = () => {
    startTransition(async () => {
      const result = await resetFinancialDataAction(accountId);
      if (result.message === 'error') {
        toast({
          title: 'Erro ao zerar dados',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Sucesso!',
          description: 'Os dados financeiros foram zerados.',
        });
        setIsDialogOpen(false);
      }
    });
  };

  return (
       <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <AlertDialogTrigger asChild>
                <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    onClick={() => setIsDialogOpen(true)}
                >
                    <Trash2 className="mr-2 h-4 w-4" />
                   Zerar Dados Financeiros
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                <AlertDialogDescription>
                   Essa ação não pode ser desfeita. Isso excluirá permanentemente todos os aluguéis finalizados e o histórico de faturamento.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset} disabled={isPending} className="bg-destructive hover:bg-destructive/90">
                    {isPending ? <Spinner size="small" /> : 'Sim, zerar dados'}
                </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
       </AlertDialog>
  );
}
