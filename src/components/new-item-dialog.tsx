
'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
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
   
   const sheetContentClasses = {
    client: "sm:max-w-2xl",
    dumpster: "sm:max-w-lg",
    team: "sm:max-w-lg",
    clientAdmin: "sm:max-w-lg",
   }
   
  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button className="h-16 w-16 rounded-full shadow-lg">
            {iconComponent[itemType]}
            <span className="sr-only">{titles[itemType]}</span>
        </Button>
      </SheetTrigger>
      <SheetContent 
        className={cn("p-0 flex flex-col", sheetContentClasses[itemType])}
      >
        <SheetHeader className="p-6 pb-4">
          <SheetTitle>{titles[itemType]}</SheetTitle>
          <SheetDescription>
            {descriptions[itemType]}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-grow overflow-y-auto px-1 py-4">
            {formComponent[itemType]}
        </div>
      </SheetContent>
    </Sheet>
  );
}
