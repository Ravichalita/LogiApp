
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
  DialogPortal,
} from '@/components/ui/dialog';
import { Plus, UserPlus, Building } from 'lucide-react';
import { ClientForm } from '@/app/clients/client-form';
import { DumpsterForm } from '@/app/dumpsters/dumpster-form';
import { InviteForm } from '@/app/team/invite-form';
import { AdminInviteForm } from '@/app/team/admin-invite-form';
import { cn } from '@/lib/utils';


interface NewItemDialogProps {
  itemType: 'client' | 'dumpster' | 'team' | 'clientAdmin';
  onSuccess?: () => void;
}

export function NewItemDialog({ itemType, onSuccess }: NewItemDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  // Add a key to force re-mounting of the form component on open/close
  const [formKey, setFormKey] = useState(Date.now());

  const titles = {
    client: 'Novo Cliente',
    dumpster: 'Nova Caçamba',
    team: 'Adicionar membro à equipe',
    clientAdmin: 'Cadastrar Novo Cliente (Admin)',
  };

  const descriptions = {
    client: 'Adicione um novo cliente à sua lista.',
    dumpster: 'Cadastre uma nova caçamba no seu inventário.',
    team: 'Crie uma conta para um funcionário. Ele terá acesso aos dados da sua empresa com as permissões que você definir.',
    clientAdmin: 'Crie uma nova conta de administrador para seu cliente. Ele terá uma conta separada e isolada para gerenciar os próprios dados.',
  };

  const handleSave = () => {
    handleOpenChange(false);
    onSuccess?.();
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // When the dialog closes, change the key to ensure the form remounts next time
      setFormKey(Date.now());
    }
  };

  const formComponent = {
    client: <ClientForm key={formKey} onSave={handleSave} />,
    dumpster: <DumpsterForm key={formKey} onSave={handleSave} />,
    team: <InviteForm key={formKey} onSave={handleSave} />,
    clientAdmin: <AdminInviteForm key={formKey} onSave={handleSave} />,
  };
  
   const iconComponent = {
    client: <Plus className="h-8 w-8" />,
    dumpster: <Plus className="h-8 w-8" />,
    team: <UserPlus className="h-7 w-7" />,
    clientAdmin: <Building className="h-7 w-7" />,
   }
   
   const dialogContentClasses = {
    client: "sm:max-w-2xl",
    dumpster: "sm:max-w-lg",
    team: "sm:max-w-lg",
    clientAdmin: "sm:max-w-lg",
   }
   
  const usePortal = itemType !== 'client';

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="h-16 w-16 rounded-full shadow-lg">
            {iconComponent[itemType]}
            <span className="sr-only">{titles[itemType]}</span>
        </Button>
      </DialogTrigger>
      {usePortal ? (
          <DialogPortal>
             <DialogContent className={cn("p-0", dialogContentClasses[itemType])}>
                <DialogHeader>
                  <DialogTitle>{titles[itemType]}</DialogTitle>
                  <DialogDescription>
                    {descriptions[itemType]}
                  </DialogDescription>
                </DialogHeader>
                <div className="flex-grow overflow-y-auto px-6 py-4">
                    {formComponent[itemType]}
                </div>
              </DialogContent>
          </DialogPortal>
      ) : (
          <DialogContent className={cn("p-0", dialogContentClasses[itemType])}>
            <DialogHeader>
              <DialogTitle>{titles[itemType]}</DialogTitle>
              <DialogDescription>
                {descriptions[itemType]}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-grow overflow-y-auto px-6 py-4">
                {formComponent[itemType]}
            </div>
          </DialogContent>
      )}
    </Dialog>
  );
}
