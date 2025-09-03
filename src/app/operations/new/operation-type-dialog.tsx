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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { OperationType } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';

interface OperationTypeDialogProps {
  operationTypes: OperationType[];
  selectedTypeIds: string[];
  onSave: (selectedIds: string[]) => void;
  children: React.ReactNode;
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export function OperationTypeDialog({ operationTypes, selectedTypeIds, onSave, children }: OperationTypeDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentSelection, setCurrentSelection] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setCurrentSelection(selectedTypeIds);
    }
  }, [isOpen, selectedTypeIds]);

  const handleSelectionChange = (typeId: string, checked: boolean) => {
    if (checked) {
      setCurrentSelection(prev => [...prev, typeId]);
    } else {
      setCurrentSelection(prev => prev.filter(id => id !== typeId));
    }
  };

  const handleConfirm = () => {
    onSave(currentSelection);
    setIsOpen(false);
  };

  const totalValue = currentSelection.reduce((acc, id) => {
    const type = operationTypes.find(t => t.id === id);
    return acc + (type?.value || 0);
  }, 0);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Selecione os Tipos de Operação</DialogTitle>
        </DialogHeader>
        <div className="py-4">
            <ScrollArea className="h-72">
                <div className="space-y-4 pr-6">
                    {operationTypes.map((type) => (
                        <div key={type.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted/50">
                            <Checkbox
                                id={`type-${type.id}`}
                                checked={currentSelection.includes(type.id)}
                                onCheckedChange={(checked) => handleSelectionChange(type.id, !!checked)}
                            />
                            <Label htmlFor={`type-${type.id}`} className="flex justify-between items-center w-full cursor-pointer">
                                <span>{type.name}</span>
                                <span className="text-muted-foreground">{formatCurrency(type.value)}</span>
                            </Label>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button onClick={handleConfirm}>
            Confirmar (Total: {formatCurrency(totalValue)})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
