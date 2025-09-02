
'use client';

import { useState, useEffect } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AdditionalCost } from '@/lib/types';
import { PlusCircle, Trash2 } from 'lucide-react';
import { nanoid } from 'nanoid';

interface CostsDialogProps {
  costs: AdditionalCost[];
  onSave: (costs: AdditionalCost[]) => void;
  children: React.ReactNode;
}

const formatCurrencyForInput = (valueInCents: string): string => {
    if (!valueInCents) return '0,00';
    const numericValue = parseInt(valueInCents.replace(/\D/g, ''), 10) || 0;
    const reais = Math.floor(numericValue / 100);
    const centavos = (numericValue % 100).toString().padStart(2, '0');
    return `${reais.toLocaleString('pt-BR')},${centavos}`;
};

export function CostsDialog({ costs: initialCosts, onSave, children }: CostsDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentCosts, setCurrentCosts] = useState<AdditionalCost[]>([]);

  useEffect(() => {
    if (isOpen) {
      setCurrentCosts(initialCosts);
    }
  }, [isOpen, initialCosts]);

  const handleValueChange = (id: string, value: string) => {
    const cents = parseInt(value.replace(/\D/g, ''), 10) || 0;
    setCurrentCosts(current =>
      current.map(c => (c.id === id ? { ...c, value: cents / 100 } : c))
    );
  };

  const handleNameChange = (id: string, name: string) => {
    setCurrentCosts(current =>
      current.map(c => (c.id === id ? { ...c, name } : c))
    );
  };

  const addCost = () => {
    setCurrentCosts(current => [...current, { id: nanoid(5), name: '', value: 0 }]);
  };

  const removeCost = (id: string) => {
    setCurrentCosts(current => current.filter(c => c.id !== id));
  };

  const handleConfirm = () => {
    onSave(currentCosts.filter(c => c.name.trim() !== '' && c.value > 0));
    setIsOpen(false);
  };

  const total = currentCosts.reduce((acc, cost) => acc + cost.value, 0);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Custos Adicionais da Operação</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
            <div className="max-h-64 overflow-y-auto space-y-2 pr-2 -mr-2">
                {currentCosts.map((cost) => (
                    <div key={cost.id} className="flex items-center gap-2">
                        <Input
                            placeholder="Nome do Custo (Ex: Ajudante)"
                            value={cost.name}
                            onChange={e => handleNameChange(cost.id, e.target.value)}
                        />
                         <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                            <Input
                                placeholder="0,00"
                                value={formatCurrencyForInput((cost.value * 100).toString())}
                                onChange={e => handleValueChange(cost.id, e.target.value)}
                                className="pl-8 text-right w-32"
                            />
                        </div>
                         <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeCost(cost.id)}
                            aria-label="Remover Custo"
                         >
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    </div>
                ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addCost}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Adicionar Custo
            </Button>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button onClick={handleConfirm}>
            Confirmar (Total: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
