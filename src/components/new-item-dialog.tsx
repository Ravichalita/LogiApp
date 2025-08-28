
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
import { Plus, UserPlus, Building } from 'lucide-react';
import { DumpsterForm } from '@/app/dumpsters/dumpster-form';
import { InviteForm } from '@/app/team/invite-form';
import { AdminInviteForm } from '@/app/team/admin-invite-form';
import { cn } from '@/lib/utils';


interface NewItemDialogProps {
  itemType: 'dumpster' | 'team' | 'clientAdmin';
  onSuccess?: () => void;
}

export function NewItemDialog({ itemType, onSuccess }: NewItemDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

  const titles = {
    dumpster: 'Nova Caçamba',
    team: 'Adicionar membro à equipe',
    clientAdmin: 'Cadastrar Novo Cliente (Admin)',
  };

  const descriptions = {
    dumpster: 'Cadastre uma nova caçamba no seu inventário.',
    team: 'Crie uma conta para um funcionário. Ele terá acesso aos dados da sua empresa com as permissões que você definir.',
    clientAdmin: 'Crie uma nova conta de administrador para seu cliente. Ele terá uma conta separada e isolada para gerenciar os próprios dados.',
  };
  
  const handleSave = () => {
    setIsOpen(false);
    onSuccess?.();
  }

  const formComponent = {
    dumpster: <DumpsterForm onSave={handleSave} />,
    team: <InviteForm onSave={handleSave} />,
    clientAdmin: <AdminInviteForm onSave={handleSave} />,
  };
  
   const iconComponent = {
    dumpster: <Plus className="h-8 w-8" />,
    team: <UserPlus className="h-7 w-7" />,
    clientAdmin: <Building className="h-7 w-7" />,
   }
   
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="h-16 w-16 rounded-full shadow-lg">
            {iconComponent[itemType as keyof typeof iconComponent]}
            <span className="sr-only">{titles[itemType as keyof typeof titles]}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="p-0">
        <DialogHeader>
          <DialogTitle>{titles[itemType as keyof typeof titles]}</DialogTitle>
          <DialogDescription>
            {descriptions[itemType as keyof typeof descriptions]}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto px-1 py-4">
            {formComponent[itemType as keyof typeof formComponent]}
        </div>
      </DialogContent>
    </Dialog>
  );
}
