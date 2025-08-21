
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { ClientForm } from '@/app/clients/client-form';
import { DumpsterForm } from '@/app/dumpsters/dumpster-form';


interface NewItemDialogProps {
  itemType: 'client' | 'dumpster';
}

export function NewItemDialog({ itemType }: NewItemDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

  const titles = {
    client: 'Novo Cliente',
    dumpster: 'Nova Caçamba',
  };

  const descriptions = {
    client: 'Adicione um novo cliente à sua lista.',
    dumpster: 'Cadastre uma nova caçamba no seu inventário.',
  };

  const formComponent = {
    client: <ClientForm onSave={() => setIsOpen(false)} />,
    dumpster: <DumpsterForm onSave={() => setIsOpen(false)} />,
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="h-16 w-16 rounded-full shadow-lg">
            <Plus className="h-8 w-8" />
            <span className="sr-only">{titles[itemType]}</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titles[itemType]}</DialogTitle>
          <DialogDescription>
            {descriptions[itemType]}
          </DialogDescription>
        </DialogHeader>
        <div className="pt-4">
            {formComponent[itemType]}
        </div>
      </DialogContent>
    </Dialog>
  );
}
