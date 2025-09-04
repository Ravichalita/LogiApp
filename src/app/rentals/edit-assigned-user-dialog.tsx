

'use client';

import { useEffect, useState, useTransition } from 'react';
import { updateRentalAction } from '@/lib/actions';
import type { PopulatedRental, UserAccount } from '@/lib/types';
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
  rental: PopulatedRental;
  teamMembers: UserAccount[];
  children: React.ReactNode;
}

export function EditAssignedUserDialog({ rental, teamMembers, children }: EditAssignedUserDialogProps) {
  const { accountId } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [assignedToId, setAssignedToId] = useState<string | undefined>(rental.assignedToUser?.id);
  
  const [errors, setErrors] = useState<any>({});
  const { toast } = useToast();

  const handleFormAction = (formData: FormData) => {
    startTransition(async () => {
      if (!accountId) {
        toast({ title: 'Erro', description: 'Conta não identificada.', variant: 'destructive' });
        return;
      }
      
      const boundAction = updateRentalAction.bind(null, accountId);
      const result = await boundAction(null, formData);

      if (result?.errors) {
        setErrors(result.errors);
        const errorMessages = Object.values(result.errors).flat().join(' ');
        toast({
          title: 'Erro de Validação',
          description: errorMessages,
          variant: 'destructive',
        });
      } else if (result?.message === 'error') {
         toast({ title: 'Erro', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Sucesso', description: 'Usuário designado atualizado.' });
        setIsOpen(false);
      }
    });
  };

  useEffect(() => {
    // Reset form if dialog is closed without saving
    if (!isOpen) {
      setAssignedToId(rental.assignedToUser?.id);
      setErrors({});
    }
  }, [isOpen, rental]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button type="button" className="text-left bg-transparent p-0 h-auto hover:underline focus:outline-none focus:ring-1 focus:ring-ring rounded-sm px-0.5 -mx-0.5">
          {children}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alterar Usuário Designado da OS</DialogTitle>
        </DialogHeader>
        <form action={handleFormAction} className="space-y-4 pt-4">
            <input type="hidden" name="id" value={rental.id} />
            
            <div className="space-y-2">
                <Label htmlFor="assignedTo">Designar para</Label>
                <Select name="assignedTo" value={assignedToId} onValueChange={setAssignedToId} required>
                    <SelectTrigger>
                        <SelectValue placeholder="Selecione um membro da equipe" />
                    </SelectTrigger>
                    <SelectContent>
                        {teamMembers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                </Select>
                 {errors?.assignedTo && <p className="text-sm font-medium text-destructive">{errors.assignedTo[0]}</p>}
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
