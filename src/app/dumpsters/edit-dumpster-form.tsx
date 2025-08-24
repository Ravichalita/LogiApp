
'use client';

import { useState, useEffect, useTransition } from 'react';
import { updateDumpster } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import type { Dumpster, DumpsterColor } from '@/lib/types';
import { DUMPSTER_COLORS } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { Spinner } from '@/components/ui/spinner';
import { DialogClose, DialogFooter } from '@/components/ui/dialog';


const initialState = {
  errors: {},
  message: '',
};

function SubmitButton({ isPending }: { isPending: boolean }) {
  return (
    <Button type="submit" disabled={isPending}>
      {isPending ? <Spinner size="small" /> : 'Salvar Alterações'}
    </Button>
  );
}

export function EditDumpsterForm({ dumpster, onSave }: { dumpster: Dumpster, onSave: () => void }) {
  const { accountId } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState(initialState);
  const [color, setColor] = useState<DumpsterColor>(dumpster.color as DumpsterColor);
  const { toast } = useToast();

  useEffect(() => {
    if (state?.message === 'success') {
      toast({
        title: "Sucesso!",
        description: "Caçamba atualizada.",
      });
      onSave();
    } else if (state?.message === 'error' && state.error) {
      toast({
        title: "Erro",
        description: state.error,
        variant: "destructive",
      });
    }
  }, [state, toast, onSave]);

  const handleFormAction = (formData: FormData) => {
    startTransition(async () => {
      if (!accountId) return;
      const boundAction = updateDumpster.bind(null, accountId, state);
      const result = await boundAction(formData);
      setState(result);
    });
  };

  return (
    <>
      <form action={handleFormAction} className="space-y-4 overflow-y-auto px-6 py-4 flex-grow">
        <input type="hidden" name="id" value={dumpster.id} />
        <div className="space-y-2">
          <Label htmlFor="name">Nome/Identificador</Label>
          <Input id="name" name="name" defaultValue={dumpster.name} required />
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
                      id={`edit-color-${colorName}`}
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
            <Input id="size" name="size" type="number" defaultValue={dumpster.size} required />
            {state?.errors?.size && <p className="text-sm font-medium text-destructive">{state.errors.size[0]}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select name="status" defaultValue={dumpster.status} required>
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
      </form>
       <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Cancelar</Button>
          </DialogClose>
          <SubmitButton isPending={isPending} />
        </DialogFooter>
    </>
  );
}
