
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  model: z.string().min(2, 'O modelo deve ter pelo menos 2 caracteres.'),
  licensePlate: z.string().length(7, 'A placa deve ter 7 caracteres.'),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1),
  capacity: z.string().min(1, 'A capacidade é obrigatória.'),
});

type TruckFormValues = z.infer<typeof formSchema>;

interface TruckFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function TruckForm({ onSuccess, onCancel }: TruckFormProps) {
  const { toast } = useToast();
  const form = useForm<TruckFormValues>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit = async (values: TruckFormValues) => {
    try {
      // TODO: Implement API call to save the truck
      console.log(values);
      toast({
        title: 'Caminhão Adicionado',
        description: 'O novo caminhão foi adicionado com sucesso.',
      });
      onSuccess();
    } catch (error) {
        console.error(error);
        toast({
            title: 'Erro',
            description: 'Não foi possível adicionar o caminhão.',
            variant: 'destructive',
        });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="model"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Modelo</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Scania R450" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="licensePlate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Placa</FormLabel>
              <FormControl>
                <Input placeholder="Ex: BRA2E19" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="year"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ano</FormLabel>
              <FormControl>
                <Input type="number" placeholder="Ex: 2023" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10))} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="capacity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Capacidade</FormLabel>
              <FormControl>
                <Input placeholder="Ex: 25 toneladas" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit">Salvar</Button>
        </div>
      </form>
    </Form>
  );
}
