
'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { triggerBackupAction } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from '@/components/ui/spinner';
import { HardDriveDownload } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export function BackupSection({ accountId }: { accountId: string }) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleBackup = () => {
    startTransition(async () => {
      toast({
        title: 'Iniciando Backup...',
        description: 'Aguarde, isso pode levar alguns minutos.',
      });
      const result = await triggerBackupAction(accountId);
      if (result.message === 'error') {
        toast({
          title: 'Erro no Backup',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Backup Concluído!',
          description: `Arquivo ${result.fileName} salvo com sucesso.`,
        });
        // Here we would ideally refresh the list of backups
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
            <h4 className="font-medium">Backup Manual</h4>
            <p className="text-sm text-muted-foreground">
                Crie um backup completo de todos os dados da sua conta agora.
            </p>
        </div>
        <Button onClick={handleBackup} disabled={isPending}>
          {isPending ? (
            <>
              <Spinner size="small" />
              <span>Gerando Backup...</span>
            </>
          ) : (
            <>
              <HardDriveDownload />
              <span>Criar Novo Backup</span>
            </>
          )}
        </Button>
      </div>

      <Separator />

      <div>
        <h4 className="font-medium">Histórico de Backups</h4>
        <div className="mt-4 rounded-md border border-dashed flex items-center justify-center h-24">
            <p className="text-sm text-muted-foreground">
                A lista de backups aparecerá aqui.
            </p>
        </div>
      </div>
    </div>
  );
}
