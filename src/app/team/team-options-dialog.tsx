
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, UserPlus, Building } from 'lucide-react';
import { InviteForm } from './invite-form';
import { AdminInviteForm } from './admin-invite-form';
import { useAuth } from '@/context/auth-context';

export function TeamOptionsDialog() {
  const [mainOpen, setMainOpen] = useState(false);
  const [formType, setFormType] = useState<'member' | 'client' | null>(null);
  const { isSuperAdmin } = useAuth();

  const handleFormOpen = (type: 'member' | 'client') => {
    setFormType(type);
    setMainOpen(false); // Close the main dialog to open the form dialog
  };

  const handleFormClose = () => {
    setFormType(null);
  };
  
  const handleSuccess = () => {
    setFormType(null); // Close form dialog on success
  }

  const formDialogs = {
    member: (
      <Dialog open={formType === 'member'} onOpenChange={(open) => !open && handleFormClose()}>
        <DialogContent className="p-0">
          <DialogHeader>
            <DialogTitle>Convidar Membro para a Equipe</DialogTitle>
            <DialogDescription>
              Crie uma conta para um funcionário. Ele terá acesso aos dados da sua empresa com as permissões que você definir.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-grow overflow-y-auto px-1 py-4">
            <InviteForm onSave={handleSuccess} />
          </div>
        </DialogContent>
      </Dialog>
    ),
    client: (
       <Dialog open={formType === 'client'} onOpenChange={(open) => !open && handleFormClose()}>
        <DialogContent className="p-0">
          <DialogHeader>
            <DialogTitle>Cadastrar Novo Cliente (Admin)</DialogTitle>
            <DialogDescription>
             Crie uma nova conta de administrador para seu cliente. Ele terá uma conta separada e isolada para gerenciar os próprios dados.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-grow overflow-y-auto px-1 py-4">
            <AdminInviteForm onSave={handleSuccess} />
          </div>
        </DialogContent>
      </Dialog>
    ),
  };

  return (
    <>
      <Dialog open={mainOpen} onOpenChange={setMainOpen}>
        <DialogTrigger asChild>
          <Button className="h-16 w-16 rounded-full shadow-lg">
            <UserPlus className="h-7 w-7" />
            <span className="sr-only">Adicionar Usuário</span>
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Usuário</DialogTitle>
            <DialogDescription>
              O que você gostaria de fazer?
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-4">
            <Button variant="outline" className="h-24 flex-col gap-2" onClick={() => handleFormOpen('member')}>
              <UserPlus className="h-8 w-8" />
              Convidar Membro para a Equipe
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {formType && formDialogs[formType]}
    </>
  );
}
