
'use client';

import { useState, useTransition, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { createFirestoreBackupAction, restoreFirestoreBackupAction, deleteFirestoreBackupAction } from '@/lib/actions';
import { getBackupsAction } from '@/lib/data-server-actions';
import { HardDrive, Info, Trash2, List, RotateCcw } from 'lucide-react';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { Backup } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';


export function BackupRestore({ accountId }: { accountId: string }) {
  const { toast } = useToast();
  const [isBackupPending, startBackupTransition] = useTransition();
  const [isRestorePending, startRestoreTransition] = useTransition();
  const [isDeletePending, startDeleteTransition] = useTransition();

  const [backups, setBackups] = useState<Backup[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(true);

  useEffect(() => {
    async function loadBackups() {
      if (!accountId) return;
      setIsLoadingBackups(true);
      const fetchedBackups = await getBackupsAction(accountId);
      setBackups(fetchedBackups);
      setIsLoadingBackups(false);
    }
    loadBackups();
  }, [accountId]);
 
  const handleCreateBackup = () => {
    if (!accountId) return;
    startBackupTransition(async () => {
      const result = await createFirestoreBackupAction(accountId);
      if (result.message === 'error') {
        toast({
          title: 'Erro ao Criar Backup',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Backup Iniciado com Sucesso!',
          description: 'Uma cópia de segurança dos seus dados foi criada.',
        });
        // Refresh the list after creating a new backup
        const fetchedBackups = await getBackupsAction(accountId);
        setBackups(fetchedBackups);
      }
    });
  };

  const handleRestoreBackup = (backupId: string) => {
    if (!accountId) return;
    startRestoreTransition(async () => {
      const result = await restoreFirestoreBackupAction(accountId, backupId);
      if (result.message === 'error') {
        toast({
          title: 'Erro ao Restaurar Backup',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Backup Restaurado com Sucesso!',
          description: 'Seus dados foram restaurados. Pode ser necessário recarregar a página.',
        });
      }
    });
  }

  const handleDeleteBackup = (backupId: string) => {
    if (!accountId) return;
    startDeleteTransition(async () => {
      const result = await deleteFirestoreBackupAction(accountId, backupId);
      if (result.message === 'error') {
        toast({
          title: 'Erro ao Excluir Backup',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Backup Excluído!',
          description: 'O registro do backup foi removido com sucesso.',
        });
        setBackups(currentBackups => currentBackups.filter(b => b.id !== backupId));
      }
    });
  }

  const isActionPending = isBackupPending || isRestorePending || isDeletePending;

  return (
    <div className="space-y-6">
       <Separator />
       <div className="space-y-4 rounded-lg px-4">
        <div className="space-y-1">
            <h4 className="font-medium">Operações Manuais</h4>
            <p className="text-sm text-muted-foreground">
                Crie um snapshot ou restaure os dados a partir de um ponto anterior. A restauração é um processo irreversível.
            </p>
        </div>
         <Button onClick={handleCreateBackup} disabled={isActionPending} className="w-full md:w-auto">
            {isBackupPending ? <Spinner size="small" /> : <HardDrive className="mr-2 h-4 w-4" />}
            Criar Backup Agora
        </Button>
        <div className="space-y-2">
            <h5 className="text-sm font-medium text-muted-foreground">Backups Disponíveis</h5>
            {isLoadingBackups ? (
                 <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
            ) : backups.length > 0 ? (
                 <div className="max-h-[22rem] overflow-y-auto space-y-2 rounded-md bg-card p-2">
                    {backups.map(backup => (
                        <div key={backup.id} className="flex items-center justify-between rounded-md border p-2 bg-muted">
                            <div className="flex items-center gap-2">
                                <List className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">
                                    {format(parseISO(backup.createdAt), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="sm" disabled={isActionPending}>
                                            <RotateCcw className="mr-2 h-4 w-4" /> Restaurar
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Esta ação é irreversível. Todos os dados atuais da sua conta serão <span className="font-bold text-destructive">permanentemente excluídos</span> e substituídos pelos dados do backup de <span className="font-bold">{format(parseISO(backup.createdAt), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}</span>.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel disabled={isRestorePending}>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction
                                                disabled={isRestorePending}
                                                onClick={() => handleRestoreBackup(backup.id)}
                                                className="bg-destructive hover:bg-destructive/90"
                                            >
                                                {isRestorePending ? <Spinner size="small" /> : 'Sim, Restaurar Backup'}
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>

                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" disabled={isActionPending} className="text-destructive hover:text-destructive">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Excluir este backup?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Esta ação é irreversível e excluirá permanentemente os dados deste backup. Isso não afetará os dados atuais da sua conta.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel disabled={isDeletePending}>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction
                                                disabled={isDeletePending}
                                                onClick={() => handleDeleteBackup(backup.id)}
                                                className="bg-destructive hover:bg-destructive/90"
                                            >
                                                {isDeletePending ? <Spinner size="small" /> : 'Sim, Excluir Backup'}
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </div>
                    ))}
                 </div>
            ) : (
                <p className="text-sm text-center text-muted-foreground py-4">Nenhum backup encontrado.</p>
            )}
        </div>
       </div>
    </div>
  );
}
