
'use client';

import { useState, useTransition, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { getBackupsAction, restoreFirestoreBackupAction } from '@/lib/actions';
import type { Backup } from '@/lib/types';
import { HardDrive, RotateCcw, List, TriangleAlert } from 'lucide-react';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function RestoreFromBackupPage() {
  const { accountId, logout } = useAuth();
  const { toast } = useToast();
  const [backups, setBackups] = useState<Backup[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(true);
  const [isRestoring, startRestoreTransition] = useTransition();

  useEffect(() => {
    async function loadBackups() {
      if (!accountId) {
          setIsLoadingBackups(false);
          return;
      };
      setIsLoadingBackups(true);
      const fetchedBackups = await getBackupsAction(accountId);
      setBackups(fetchedBackups);
      setIsLoadingBackups(false);
    }
    loadBackups();
  }, [accountId]);
  
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
          description: 'Seus dados foram restaurados. A página será recarregada.',
        });
        // Reload the page to re-trigger the AuthProvider logic
        window.location.reload();
      }
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
            <div className="mx-auto mb-4 bg-destructive/10 text-destructive rounded-full p-3 w-fit">
                <TriangleAlert className="h-8 w-8" />
            </div>
            <CardTitle className="text-2xl font-bold">Recuperação de Conta</CardTitle>
            <CardDescription>
                Não encontramos os dados da sua conta, mas parece que você tem backups salvos. Escolha um ponto de restauração abaixo para recuperar seus dados.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="space-y-2">
                <h5 className="text-sm font-medium text-muted-foreground">Backups Disponíveis</h5>
                {isLoadingBackups ? (
                    <div className="space-y-2">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                ) : backups.length > 0 ? (
                     <div className="max-h-60 overflow-y-auto space-y-2 rounded-md border bg-background p-2">
                         {backups.map(backup => (
                             <div key={backup.id} className="flex items-center justify-between rounded-md p-2 bg-muted">
                                 <div className="flex items-center gap-2">
                                     <List className="h-4 w-4 text-muted-foreground" />
                                     <span className="text-sm font-medium">
                                        {format(parseISO(backup.createdAt), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                                     </span>
                                 </div>
                                 <AlertDialog>
                                     <AlertDialogTrigger asChild>
                                        <Button size="sm" disabled={isRestoring}>
                                            <RotateCcw className="mr-2 h-4 w-4" /> Restaurar
                                        </Button>
                                     </AlertDialogTrigger>
                                     <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Esta ação é irreversível. Todos os dados atuais (se houver) serão <span className="font-bold text-destructive">permanentemente excluídos</span> e substituídos pelos dados deste backup.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel disabled={isRestoring}>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction
                                                disabled={isRestoring}
                                                onClick={() => handleRestoreBackup(backup.id)}
                                                className="bg-destructive hover:bg-destructive/90"
                                            >
                                                {isRestoring ? <Spinner size="small" /> : 'Sim, Restaurar Agora'}
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                     </AlertDialogContent>
                                 </AlertDialog>
                             </div>
                         ))}
                     </div>
                ) : (
                    <p className="text-sm text-center text-muted-foreground py-4">Nenhum backup encontrado para esta conta.</p>
                )}
            </div>
        </CardContent>
        <CardContent>
            <Button variant="outline" className="w-full" onClick={logout}>
                Sair e Tentar Novamente
            </Button>
        </CardContent>
      </Card>
    </div>
  );
}

