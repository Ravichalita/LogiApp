
'use client';

import { useState, useTransition } from 'react';
import { resetFinancialDataAction } from '@/lib/actions';
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
import { Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ResetButton({ accountId }: { accountId: string }) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
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
          description: 'Todos os dados financeiros foram zerados.',
        });
        setIsDialogOpen(false);
        setIsExpanded(false);
      }
    });
  };

  return (
    <div className="flex justify-start items-center mt-8">
       <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <div className="flex items-center space-x-2">
                <Button 
                    variant="destructive"
                    size="icon"
                    className="rounded-full h-12 w-12 z-10 flex-shrink-0"
                    onClick={() => setIsExpanded(!isExpanded)}
                    aria-expanded={isExpanded}
                >
                    <X className={cn("transition-transform duration-300", isExpanded && "rotate-45")}/>
                </Button>
                
                <div 
                    className={cn(
                        "transition-all duration-300 ease-in-out overflow-hidden flex items-center",
                        isExpanded ? "max-w-xs" : "max-w-0"
                    )}
                >
                    <AlertDialogTrigger asChild>
                         <Button
                            variant="destructive"
                            className="whitespace-nowrap -ml-4 pl-8 pr-4 h-12 rounded-r-full rounded-l-none"
                            onClick={() => setIsDialogOpen(true)}
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Zerar todos os dados financeiros
                        </Button>
                    </AlertDialogTrigger>
                </div>
            </div>

            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                <AlertDialogDescription>
                    Essa ação não pode ser desfeita. Isso excluirá permanentemente todo o histórico de faturamento e os registros de aluguéis finalizados.
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
    </div>
  );
}
