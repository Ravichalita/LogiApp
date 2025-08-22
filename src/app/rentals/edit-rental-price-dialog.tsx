
'use client';

import { useEffect, useState, useTransition } from 'react';
import { updateRentalAction } from '@/lib/actions';
import type { PopulatedRental } from '@/lib/types';
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
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { Spinner } from '@/components/ui/spinner';

interface EditRentalDialogProps {
  rental: PopulatedRental;
  children: React.ReactNode;
}

const formatCurrencyForInput = (valueInCents: string): string => {
    if (!valueInCents) return '0,00';
    const numericValue = parseInt(valueInCents.replace(/\D/g, ''), 10) || 0;
    const reais = Math.floor(numericValue / 100);
    const centavos = (numericValue % 100).toString().padStart(2, '0');
    return `${reais.toLocaleString('pt-BR')},${centavos}`;
};


export function EditRentalPriceDialog({ rental, children }: EditRentalDialogProps) {
  const { accountId } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [value, setValue] = useState(formatCurrencyForInput((rental.value * 100).toString()));
  const [errors, setErrors] = useState<any>({});
  const { toast } = useToast();

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    setValue(formatCurrencyForInput(rawValue));
  }

  const handleFormAction = (formData: FormData) => {
    startTransition(async () => {
      if (!accountId) {
        toast({ title: 'Erro', description: 'Conta não identificada.', variant: 'destructive' });
        return;
      }
      
      formData.set('value', value);
      
      const boundAction = updateRentalAction.bind(null, accountId);
      const result = await boundAction(null, formData);

      if (result.errors) {
        setErrors(result.errors);
        const errorMessages = Object.values(result.errors).flat().join(' ');
        toast({
          title: 'Erro de Validação',
          description: errorMessages,
          variant: 'destructive',
        });
      } else if (result.message === 'error') {
         toast({ title: 'Erro', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Sucesso', description: 'Preço do aluguel atualizado.' });
        setIsOpen(false);
      }
    });
  };

  useEffect(() => {
    if (!isOpen) {
      setValue(formatCurrencyForInput((rental.value * 100).toString()));
      setErrors({});
    }
  }, [isOpen, rental]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Preço da Diária</DialogTitle>
        </DialogHeader>
        <form action={handleFormAction} className="space-y-4 pt-4">
            <input type="hidden" name="id" value={rental.id} />
            
            <div className="space-y-2">
                <Label htmlFor="value">Valor da Diária (R$)</Label>
                <Input
                    id="value"
                    name="value"
                    value={value}
                    onChange={handleValueChange}
                    placeholder="R$ 0,00"
                    required
                    className="text-right"
                />
                 {errors?.value && <p className="text-sm font-medium text-destructive">{errors.value[0]}</p>}
            </div>

            <DialogFooter className="pt-4">
                <DialogClose asChild>
                    <Button type="button" variant="outline" disabled={isPending}>Cancelar</Button>
                </DialogClose>
                <Button type="submit" disabled={isPending}>
                    {isPending ? <Spinner size="small" /> : 'Salvar Preço'}
                </Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
