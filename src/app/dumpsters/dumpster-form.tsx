'use client';

import { useActionState, useEffect, useRef, useTransition } from 'react';
import { createDumpster } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { Spinner } from '@/components/ui/spinner';

const initialState = {
  errors: {},
  message: '',
};

function SubmitButton({ isPending }: { isPending: boolean }) {
  return (
    <Button type="submit" disabled={isPending} className="w-full">
      {isPending ? <Spinner size="small" /> : 'Salvar Caçamba'}
    </Button>
  );
}

export function DumpsterForm() {
  const { user } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [state, formAction] = useActionState(createDumpster.bind(null, user?.uid ?? ''), initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (state?.message === 'success') {
      toast({
        title: "Sucesso!",
        description: "Nova caçamba cadastrada.",
      });
      formRef.current?.reset();
    } else if (state?.message === 'error' && state.error) {
      toast({
        title: "Erro",
        description: state.error,
        variant: "destructive",
      });
    }
  }, [state, toast]);

  const handleFormAction = (formData: FormData) => {
    startTransition(() => {
      formAction(formData);
    });
  };

  if (!user) {
    return <div className="flex justify-center items-center"><Spinner /></div>;
  }

  return (
    <form ref={formRef} action={handleFormAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nome/Identificador</Label>
        <Input id="name" name="name" placeholder="Ex: Caçamba 01" required />
        {state?.errors?.name && <p className="text-sm font-medium text-destructive">{state.errors.name[0]}</p>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="color">Cor</Label>
          <Input id="color" name="color" placeholder="Ex: Vermelha" required />
          {state?.errors?.color && <p className="text-sm font-medium text-destructive">{state.errors.color[0]}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="size">Tamanho (m³)</Label>
          <Input id="size" name="size" type="number" placeholder="Ex: 5" required />
          {state?.errors?.size && <p className="text-sm font-medium text-destructive">{state.errors.size[0]}</p>}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="status">Status Inicial</Label>
        <Select name="status" defaultValue="Disponível" required>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Disponível">Disponível</SelectItem>
            <SelectItem value="Alugada">Alugada</SelectItem>
            <SelectItem value="Em Manutenção">Em Manutenção</SelectItem>
          </SelectContent>
        </Select>
         {state?.errors?.status && <p className="text-sm font-medium text-destructive">{state.errors.status[0]}</p>}
      </div>
      <SubmitButton isPending={isPending} />
    </form>
  );
}
