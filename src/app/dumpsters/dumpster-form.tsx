
'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { createDumpster } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { Spinner } from '@/components/ui/spinner';
import type { DumpsterStatus, DumpsterColor } from '@/lib/types';
import { DUMPSTER_COLORS } from '@/lib/types';
import { DialogClose } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

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

export function DumpsterForm({ onSave }: { onSave?: () => void }) {
  const { accountId } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<any>(initialState);
  const [status, setStatus] = useState<DumpsterStatus>('Disponível');
  const [color, setColor] = useState<DumpsterColor | undefined>();
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (state?.message === 'success') {
      toast({ title: 'Sucesso', description: 'Caçamba cadastrada.' });
      formRef.current?.reset();
      setStatus('Disponível');
      setColor(undefined);
      setState(initialState);
      onSave?.();
    } else if (state?.message === 'error' && state.error) {
      toast({ title: 'Erro', description: state.error, variant: 'destructive' });
      setState(prevState => ({...prevState, message: '', error: undefined }));
    }
  }, [state, toast, onSave]);

  const action = (formData: FormData) => {
    startTransition(async () => {
      if (!accountId) {
        toast({ title: 'Erro', description: 'Conta não identificada.', variant: 'destructive' });
        return;
      }
      const boundAction = createDumpster.bind(null, accountId);
      const result = await boundAction(state, formData);
      setState(result);
    });
  };

  if (!accountId) {
    return <div className="flex justify-center items-center"><Spinner /></div>;
  }

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nome/Identificador</Label>
        <Input id="name" name="name" placeholder="Ex: Caçamba 01" required />
        {state?.errors?.name && <p className="text-sm font-medium text-destructive">{state.errors.name[0]}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="color">Cor</Label>
        <TooltipProvider>
            <RadioGroup name="color" value={color} onValueChange={(value: DumpsterColor) => setColor(value)} className="flex flex-wrap gap-2">
            {(Object.keys(DUMPSTER_COLORS) as DumpsterColor[]).map((colorName) => (
                <Tooltip key={colorName}>
                <TooltipTrigger asChild>
                    <RadioGroupItem
                    value={colorName}
                    id={`color-${colorName}`}
                    className="h-8 w-8 rounded-md border-2 border-transparent focus:border-ring"
                    style={{ backgroundColor: DUMPSTER_COLORS[colorName].value }}
                    aria-label={colorName}
                    />
                </TooltipTrigger>
                <TooltipContent>
                    <p>{colorName}: {DUMPSTER_COLORS[colorName].description}</p>
                </TooltipContent>
                </Tooltip>
            ))}
            </RadioGroup>
        </TooltipProvider>
        {state?.errors?.color && <p className="text-sm font-medium text-destructive">{state.errors.color[0]}</p>}
      </div>
      <div className="space-y-2">
          <Label htmlFor="size">Tamanho (m³)</Label>
          <Input id="size" name="size" type="number" placeholder="Ex: 5" required />
          {state?.errors?.size && <p className="text-sm font-medium text-destructive">{state.errors.size[0]}</p>}
      </div>
      <div className="space-y-2">
        <Label>Status Inicial</Label>
        <Select name="status" value={status} onValueChange={(value) => setStatus(value as DumpsterStatus)}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Disponível">Disponível</SelectItem>
            <SelectItem value="Em Manutenção">Em Manutenção</SelectItem>
          </SelectContent>
        </Select>
         {state?.errors?.status && <p className="text-sm font-medium text-destructive">{state.errors.status[0]}</p>}
      </div>
       <div className="flex justify-end gap-2 pt-4">
          <DialogClose asChild>
            <Button type="button" variant="outline">Cancelar</Button>
          </DialogClose>
          <SubmitButton isPending={isPending} />
        </div>
    </form>
  );
}
