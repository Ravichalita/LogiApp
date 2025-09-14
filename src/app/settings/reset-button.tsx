
'use client';

import { useState, useTransition } from 'react';
import { 
    resetAllDataAction, 
    resetActiveRentalsAction,
    resetActiveOperationsAction,
    resetCompletedRentalsAction,
    resetCompletedOperationsAction
} from '@/lib/actions';
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
import { getFirebase } from '@/lib/firebase-client';
import { collection, query, getDocs, writeBatch, where } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';

type ResetButtonProps = {
    accountId: string;
    action: (accountId: string) => Promise<{ message: string; error?: string; }>;
    title: string;
    description: string;
    buttonText: string;
    toastSuccess: string;
    toastError: string;
};

function GenericResetButton({ accountId, action, title, description, buttonText, toastSuccess, toastError }: ResetButtonProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleReset = () => {
    startTransition(async () => {
      const result = await action(accountId);
      if (result.message === 'error') {
        toast({
          title: toastError,
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Sucesso!',
          description: toastSuccess,
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
                    {buttonText}
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>{title}</AlertDialogTitle>
                <AlertDialogDescription>{description}</AlertDialogDescription>
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


export function ResetAllDataButton({ accountId }: { accountId: string }) {
    return (
        <GenericResetButton
            accountId={accountId}
            action={resetAllDataAction}
            title="Zerar Todos os Dados da Conta?"
            description="Essa ação não pode ser desfeita. Isso excluirá permanentemente todos os aluguéis, operações, clientes, caçambas, frotas e anexos. Os dados de usuário e equipe não serão afetados."
            buttonText="Zerar Todos os Dados da Conta"
            toastSuccess="A limpeza completa dos dados foi iniciada no servidor."
            toastError="Erro ao Iniciar a Limpeza"
        />
    );
}

export function ResetActiveRentalsButton({ accountId }: { accountId: string }) {
    return (
        <GenericResetButton
            accountId={accountId}
            action={resetActiveRentalsAction}
            title="Zerar Aluguéis Ativos?"
            description="Essa ação não pode ser desfeita. Isso excluirá permanentemente todos os aluguéis em andamento e agendados."
            buttonText="Zerar Aluguéis Ativos"
            toastSuccess="Todos os aluguéis ativos foram zerados."
            toastError="Erro ao zerar os aluguéis ativos"
        />
    );
}

export function ResetActiveOperationsButton({ accountId }: { accountId: string }) {
    return (
        <GenericResetButton
            accountId={accountId}
            action={resetActiveOperationsAction}
            title="Zerar Operações Ativas?"
            description="Essa ação não pode ser desfeita. Isso excluirá permanentemente todas as operações em andamento e agendadas."
            buttonText="Zerar Operações Ativas"
            toastSuccess="Todas as operações ativas foram zeradas."
            toastError="Erro ao zerar as operações ativas"
        />
    );
}

export function ResetCompletedRentalsButton({ accountId }: { accountId: string }) {
    return (
        <GenericResetButton
            accountId={accountId}
            action={resetCompletedRentalsAction}
            title="Zerar Histórico de Aluguéis?"
            description="Essa ação não pode ser desfeita. Isso excluirá permanentemente todo o histórico de aluguéis finalizados."
            buttonText="Zerar Histórico de Aluguéis"
            toastSuccess="O histórico de aluguéis foi zerado."
            toastError="Erro ao zerar o histórico de aluguéis"
        />
    );
}

export function ResetCompletedOperationsButton({ accountId }: { accountId: string }) {
    return (
        <GenericResetButton
            accountId={accountId}
            action={resetCompletedOperationsAction}
            title="Zerar Histórico de Operações?"
            description="Essa ação não pode ser desfeita. Isso excluirá permanentemente todo o histórico de operações finalizadas."
            buttonText="Zerar Histórico de Operações"
            toastSuccess="O histórico de operações foi zerado."
            toastError="Erro ao zerar o histórico de operações"
        />
    );
}
