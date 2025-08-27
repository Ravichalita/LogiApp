
'use client';

import { useState, useTransition } from 'react';
import { useAuth } from '@/context/auth-context';
import type { Permissions, UserAccount } from '@/lib/types';
import { updateUserPermissionsAction } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';

const permissionLabels: Record<keyof Permissions, string> = {
  canAccessTeam: 'Acessar Equipe',
  canAccessFinance: 'Acessar Estatísticas',
  canAccessSettings: 'Acessar Configurações',
  canEditClients: 'Editar e Excluir Clientes',
  canEditDumpsters: 'Editar e Excluir Caçambas',
  canEditRentals: 'Editar e Excluir OS',
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
  const isTargetAdminOrOwner = member.role === 'admin' || member.role === 'owner';

  const handlePermissionChange = (
    permissionKey: keyof Permissions,
    checked: boolean
  ) => {
    if (!accountId || isCurrentUser || isTargetAdminOrOwner || isPending) return;

    const newPermissions = { ...permissions, [permissionKey]: checked };
    setPermissions(newPermissions); // Optimistic update

    startTransition(async () => {
      const result = await updateUserPermissionsAction(
        accountId,
        member.id,
        newPermissions
      );
      if (result.message === 'error') {
        // Revert optimistic update on error
        setPermissions(permissions);
        toast({
          title: 'Erro ao atualizar permissão',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Sucesso',
          description: `Permissão '${permissionLabels[permissionKey]}' atualizada para ${member.name}.`,
        });
      }
    });
  };

  if (isTargetAdminOrOwner) {
     return (
        <div className="px-4 pb-4">
             <Separator />
             <div className="pt-4 text-sm text-muted-foreground">
                 {member.role === 'owner' ? 'Proprietários' : 'Administradores'} têm acesso a todas as permissões.
             </div>
        </div>
    )
  }

  return (
    <div className="px-4 pb-4">
       <Separator />
      <div className="grid gap-4 py-4 relative">
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
         {isPending && (
            <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                <Spinner />
            </div>
        )}
      </div>
    </div>
  );
}
