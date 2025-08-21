
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { CalendarIcon, Edit } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { Spinner } from '@/components/ui/spinner';

interface EditRentalPeriodDialogProps {
  rental: PopulatedRental;
  children: React.ReactNode;
}

export function EditRentalPeriodDialog({ rental, children }: EditRentalPeriodDialogProps) {
  const { accountId } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [rentalDate, setRentalDate] = useState<Date | undefined>(new Date(rental.rentalDate));
  const [returnDate, setReturnDate] = useState<Date | undefined>(new Date(rental.returnDate));
  const [errors, setErrors] = useState<any>({});
  const { toast } = useToast();

  const handleFormAction = (formData: FormData) => {
    startTransition(async () => {
      if (!accountId) {
        toast({ title: 'Erro', description: 'Conta não identificada.', variant: 'destructive' });
        return;
      }
      
      if (rentalDate) formData.set('rentalDate', rentalDate.toISOString());
      if (returnDate) formData.set('returnDate', returnDate.toISOString());
      
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
        toast({ title: 'Sucesso', description: 'Período do aluguel atualizado.' });
        setIsOpen(false);
      }
    });
  };

  useEffect(() => {
    // Reset dates if dialog is closed without saving
    if (!isOpen) {
      setRentalDate(new Date(rental.rentalDate));
      setReturnDate(new Date(rental.returnDate));
      setErrors({});
    }
  }, [isOpen, rental.rentalDate, rental.returnDate]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Período do Aluguel</DialogTitle>
        </DialogHeader>
        <form action={handleFormAction} className="space-y-4 pt-4">
            <input type="hidden" name="id" value={rental.id} />
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Data de Entrega</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn(
                            "w-full justify-start text-left font-normal",
                            !rentalDate && "text-muted-foreground"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {rentalDate ? format(rentalDate, "PPP", { locale: ptBR }) : <span>Escolha uma data</span>}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                        <Calendar
                            mode="single"
                            selected={rentalDate}
                            onSelect={setRentalDate}
                            initialFocus
                            locale={ptBR}
                        />
                        </PopoverContent>
                    </Popover>
                    {errors?.rentalDate && <p className="text-sm font-medium text-destructive">{errors.rentalDate[0]}</p>}
                </div>
                <div className="space-y-2">
                <Label>Data de Retirada</Label>
                <Popover>
                    <PopoverTrigger asChild>
                    <Button
                        variant={"outline"}
                        className={cn(
                        "w-full justify-start text-left font-normal",
                        !returnDate && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {returnDate ? format(returnDate, "PPP", { locale: ptBR }) : <span>Escolha uma data</span>}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                    <Calendar
                        mode="single"
                        selected={returnDate}
                        onSelect={setReturnDate}
                        disabled={(date) => rentalDate ? date <= rentalDate : false}
                        initialFocus
                        locale={ptBR}
                    />
                    </PopoverContent>
                </Popover>
                {errors?.returnDate && <p className="text-sm font-medium text-destructive">{errors.returnDate[0]}</p>}
                </div>
            </div>
            <DialogFooter className="pt-4">
                <DialogClose asChild>
                    <Button type="button" variant="outline" disabled={isPending}>Cancelar</Button>
                </DialogClose>
                <Button type="submit" disabled={isPending}>
                    {isPending ? <Spinner size="small" /> : 'Salvar Alterações'}
                </Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
