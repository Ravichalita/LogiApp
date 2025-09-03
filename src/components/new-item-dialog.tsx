
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
import { Plus, UserPlus, Building, User, Truck } from 'lucide-react';
import { DumpsterForm } from '@/app/dumpsters/dumpster-form';
import { InviteForm } from '@/app/team/invite-form';
import { AdminInviteForm } from '@/app/team/admin-invite-form';
import { ClientForm } from '@/app/clients/client-form';
import { useRouter } from 'next/navigation';
import { FleetForm } from '@/app/fleet/fleet-form';

interface NewItemDialogProps {
  itemType: 'dumpster' | 'team' | 'clientAdmin' | 'client' | 'fleet';
  onSuccess?: () => void;
}

export function NewItemDialog({ itemType, onSuccess }: NewItemDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const titles = {
    dumpster: 'Nova Caçamba',
    team: 'Adicionar membro à equipe',
    clientAdmin: 'Cadastrar Novo Cliente (Admin)',
    client: 'Novo Cliente',
    fleet: 'Adicionar Caminhão'
  };

  const descriptions = {
    dumpster: 'Cadastre uma nova caçamba no seu inventário.',
    team: 'Crie uma conta para um funcionário. Ele terá acesso aos dados da sua empresa com as permissões que você definir.',
    clientAdmin: 'Crie uma nova conta de administrador para seu cliente. Ele terá uma conta separada e isolada para gerenciar os próprios dados.',
    client: 'Adicione um novo cliente à sua lista.',
    fleet: 'Preencha os dados do novo veículo da sua frota.'
  };
  
  const handleSave = () => {
    setIsOpen(false);
    onSuccess?.();
    if (itemType === 'client') {
        // Since createClient redirects, we don't need to do anything extra here
        // The redirect is handled by the server action.
    }
  }

  const formComponent = {
    dumpster: <DumpsterForm onSave={handleSave} />,
    team: <InviteForm onSave={handleSave} />,
    clientAdmin: <AdminInviteForm onSave={handleSave} />,
    client: <ClientForm />,
    fleet: <FleetForm onSave={handleSave} />,
  };
  
   const iconComponent = {
    dumpster: <Plus className="h-8 w-8" />,
    team: <UserPlus className="h-7 w-7" />,
    clientAdmin: <Building className="h-7 w-7" />,
    client: <User className="h-7 w-7" />,
    fleet: <Plus className="h-8 w-8" />
   }
   
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="h-16 w-16 rounded-full shadow-lg">
            {iconComponent[itemType]}
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
        {formComponent[itemType]}
      </DialogContent>
    </Dialog>
  );
}
