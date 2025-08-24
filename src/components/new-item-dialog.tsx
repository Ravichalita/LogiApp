
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
import { Plus, UserPlus } from 'lucide-react';
import { ClientForm } from '@/app/clients/client-form';
import { DumpsterForm } from '@/app/dumpsters/dumpster-form';
import { InviteForm } from '@/app/team/invite-form';


interface NewItemDialogProps {
  itemType: 'client' | 'dumpster' | 'team';
}

export function NewItemDialog({ itemType }: NewItemDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  // Add a key to force re-mounting of the form component on open/close
  const [formKey, setFormKey] = useState(Date.now());

  const titles = {
    client: 'Novo Cliente',
    dumpster: 'Nova Caçamba',
    team: 'Convidar Membro',
  };

  const descriptions = {
    client: 'Adicione um novo cliente à sua lista.',
    dumpster: 'Cadastre uma nova caçamba no seu inventário.',
    team: 'Preencha os dados do novo membro da equipe.',
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // When the dialog closes, change the key to ensure the form remounts next time
      setFormKey(Date.now());
    }
  };

  const formComponent = {
    client: <ClientForm key={formKey} onSave={() => handleOpenChange(false)} />,
    dumpster: <DumpsterForm key={formKey} onSave={() => handleOpenChange(false)} />,
    team: <InviteForm key={formKey} onSave={() => handleOpenChange(false)} />,
  };
  
   const iconComponent = {
    client: <Plus className="h-8 w-8" />,
    dumpster: <Plus className="h-8 w-8" />,
    team: <UserPlus className="h-7 w-7" />,
   }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="h-16 w-16 rounded-full shadow-lg">
            {iconComponent[itemType]}
            <span className="sr-only">{titles[itemType]}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="p-0">
        <DialogHeader>
          <DialogTitle>{titles[itemType]}</DialogTitle>
          <DialogDescription>
            {descriptions[itemType]}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto px-1 py-4">
            {formComponent[itemType]}
        </div>
      </DialogContent>
    </Dialog>
  );
}
