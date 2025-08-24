'use client';

import { useState, useTransition } from 'react';
import { useAuth } from '@/context/auth-context';
import type { Permissions, UserAccount } from '@/lib/types';
import { updateUserPermissionsAction } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Separator } from '@/components/ui/separator';

const permissionLabels: Record<keyof Omit<Permissions, 'canDeleteItems'>, string> = {
  canAccessTeam: 'Acessar tela de Equipe',
  canAccessFinance: 'Acessar estatísticas',
  canEditClients: 'Editar e Excluir Clientes',
  canEditDumpsters: 'Editar e Excluir Caçambas',
  canEditRentals: 'Editar e Excluir Aluguéis',
};

interface UserPermissionsFormProps {
  member: UserAccount;
}

export function UserPermissionsForm({ member }: UserPermissionsFormProps) {
  const { accountId, user } = useAuth();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [permissions, setPermissions] = useState<Permissions>(
    member.permissions || {}
  );
  
  const isCurrentUser = user?.uid === member.id;
  const isTargetAdmin = member.role === 'admin';

  const handlePermissionChange = (
    permissionKey: keyof Permissions,
    checked: boolean
  ) => {
    setPermissions((prev) => ({ ...prev, [permissionKey]: checked }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId || isCurrentUser || isTargetAdmin) return;

    startTransition(async () => {
      const result = await updateUserPermissionsAction(
        accountId,
        member.id,
        permissions
      );
      if (result.message === 'error') {
        toast({
          title: 'Erro ao atualizar permissões',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Sucesso',
          description: `Permissões de ${member.name} atualizadas.`,
        });
      }
    });
  };

  if (isTargetAdmin) {
     return (
        <div className="px-4 pb-4">
             <Separator />
             <div className="pt-4 text-sm text-muted-foreground">
                 Administradores têm acesso a todas as permissões.
             </div>
        </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="px-4 pb-4">
       <Separator />
      <div className="grid gap-4 py-4">
        {(Object.keys(permissionLabels) as Array<keyof typeof permissionLabels>).map((key) => (
          <div key={key} className="flex items-center space-x-2">
            <Checkbox
              id={`${member.id}-${key}`}
              checked={permissions[key] || false}
              onCheckedChange={(checked) =>
                handlePermissionChange(key, !!checked)
              }
              disabled={isPending || isCurrentUser}
            />
            <Label
              htmlFor={`${member.id}-${key}`}
              className="text-sm font-normal"
            >
              {permissionLabels[key]}
            </Label>
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending || isCurrentUser}>
          {isPending ? <Spinner size="small" /> : 'Salvar Permissões'}
        </Button>
      </div>
    </form>
  );
}
