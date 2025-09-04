
'use client';

import { useEffect, useState, useTransition } from 'react';
import { updateOperationAction } from '@/lib/actions';
import type { PopulatedOperation, UserAccount } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { Spinner } from '@/components/ui/spinner';

interface EditAssignedUserDialogProps {
  operation: PopulatedOperation;
  teamMembers: UserAccount[];
}

export function EditOperationAssignedUserDialog({ operation, teamMembers }: EditAssignedUserDialogProps) {
  const { accountId } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [assignedToId, setAssignedToId] = useState<string | undefined>(operation.driverId);
  const { toast } = useToast();

  const handleFormAction = (formData: FormData) => {
    startTransition(async () => {
      if (!accountId) {
        toast({ title: 'Erro', description: 'Conta não identificada.', variant: 'destructive' });
        return;
      }
      
      const boundAction = updateOperationAction.bind(null, accountId);
      const result = await boundAction(null, formData);

      if (result?.errors) {
         const errorMessages = Object.values(result.errors).flat().join(' ');
         toast({
            title: 'Erro de Validação',
            description: errorMessages,
            variant: 'destructive',
         });
      } else if (result?.message && result.message !== 'success') {
         toast({ title: 'Erro', description: result.message, variant: 'destructive' });
      } else {
        toast({ title: 'Sucesso', description: 'Responsável pela operação atualizado.' });
        setIsOpen(false);
      }
    });
  };

  useEffect(() => {
    if (!isOpen) {
      setAssignedToId(operation.driverId);
    }
  }, [isOpen, operation]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button type="button" className="text-left bg-transparent p-0 h-auto hover:underline focus:outline-none focus:ring-1 focus:ring-ring rounded-sm px-0.5 -mx-0.5">
          {operation.driver?.name}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alterar Responsável da Operação</DialogTitle>
        </DialogHeader>
        <form action={handleFormAction} className="space-y-4 pt-4">
            <input type="hidden" name="id" value={operation.id} />
            <div className="space-y-2">
                <Label htmlFor="driverId">Designar para</Label>
                <Select name="driverId" value={assignedToId} onValueChange={setAssignedToId} required>
                    <SelectTrigger>
                        <SelectValue placeholder="Selecione um membro da equipe" />
                    </SelectTrigger>
                    <SelectContent>
                        {teamMembers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <DialogFooter className="pt-4">
                <DialogClose asChild>
                    <Button type="button" variant="outline" disabled={isPending}>Cancelar</Button>
                </DialogClose>
                <Button type="submit" disabled={isPending}>
                    {isPending ? <Spinner size="small" /> : 'Salvar'}
                </Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
