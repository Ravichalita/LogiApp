

'use client';

import { useEffect, useState, useTransition } from 'react';
import type { Permissions, UserAccount } from '@/lib/types';
import { updateUserPermissionsAction } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

const permissionLabels: Partial<Record<keyof Permissions, string>> = {
  canAccessRentals: 'Aluguéis',
  canAccessOperations: 'Operações',
  canAccessFinance: 'Acessar Histórico e Valores $',
  canAccessNotificationsStudio: 'Acessar Notificações Personalizadas',
};

interface ClientPermissionsFormProps {
  client: UserAccount; // Expecting the owner user account
}

export function ClientPermissionsForm({ client }: ClientPermissionsFormProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [permissions, setPermissions] = useState<Permissions>(
    client.permissions || {}
  );
  
   useEffect(() => {
    setPermissions(client.permissions || {});
  }, [client]);

  const handlePermissionChange = (
    permissionKey: keyof Permissions,
    checked: boolean
  ) => {
    if (isPending) return;
    
    const previousPermissions = {...permissions}; 
    const newPermissions = { ...permissions, [permissionKey]: checked };
    
    setPermissions(newPermissions);

    startTransition(async () => {
      const result = await updateUserPermissionsAction(
        client.accountId,
        client.id,
        newPermissions
      );
      if (result.message === 'error') {
        setPermissions(previousPermissions);
        toast({
          title: 'Erro ao atualizar permissão',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  };

  const renderPermissionGroup = (title: string, labels: Partial<Record<keyof Permissions, string>>) => (
    <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {(Object.keys(labels) as Array<keyof typeof labels>).map((key) => (
            <div key={key} className="flex items-center space-x-2">
                <Checkbox
                id={`${client.id}-${key}`}
                checked={permissions[key] ?? false}
                onCheckedChange={(checked) => handlePermissionChange(key, !!checked)}
                disabled={isPending}
                />
                <Label htmlFor={`${client.id}-${key}`} className="text-sm font-normal">
                {labels[key]}
                </Label>
            </div>
            ))}
        </div>
    </div>
  );

  return (
    <div className="px-4 pb-4">
      <div className="space-y-6 py-4 relative">
        {renderPermissionGroup("Acesso às Telas e Funcionalidades", permissionLabels)}
        
         {isPending && (
            <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-md">
                <Spinner />
            </div>
        )}
      </div>
    </div>
  );
}
