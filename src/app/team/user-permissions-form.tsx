

'use client';

import { useState, useTransition, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import type { Permissions, UserAccount } from '@/lib/types';
import { updateUserPermissionsAction } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Shield } from 'lucide-react';

const screenPermissionLabels: Partial<Record<keyof Permissions, string>> = {
  canAccessRentals: 'Aluguéis',
  canAccessOperations: 'Operações',
  canAccessRoutes: 'Rotas',
  canAccessClients: 'Clientes',
  canAccessDumpsters: 'Caçambas',
  canAccessFleet: 'Frota',
  canAccessTeam: 'Equipe',
  canAccessSettings: 'Configurações',
};

const featurePermissionLabels: Partial<Record<keyof Permissions, string>> = {
  canAccessFinance: 'Acessar Histórico e Valores $',
  canAccessNotificationsStudio: 'Notificações Personalizadas',
  canUseAttachments: 'Gerenciar Anexos',
};

const actionsPermissionLabels: Partial<Record<keyof Permissions, string>> = {
  canEditRentals: 'Editar/Excluir OS de Aluguel',
  canEditOperations: 'Editar/Excluir OS de Operação',
  canEditDumpsters: 'Editar/Excluir Caçambas',
  canEditFleet: 'Editar/Excluir Caminhões',
  canAddClients: 'Adicionar Clientes',
  canEditClients: 'Editar/Excluir Clientes',
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
  const isTargetOwner = member.role === 'owner';
  const isTargetAdmin = member.role === 'admin';
  const isTargetViewer = member.role === 'viewer';


  useEffect(() => {
    setPermissions(member.permissions || {});
  }, [member.permissions]);

  const handlePermissionChange = (
    permissionKey: keyof Permissions,
    checked: boolean
  ) => {
    if (!accountId || isCurrentUser || isTargetAdmin || isTargetOwner || isPending) return;

    const previousPermissions = {...permissions}; 

    const newPermissions = { ...permissions, [permissionKey]: checked };
    
    setPermissions(newPermissions);

    startTransition(async () => {
      const result = await updateUserPermissionsAction(
        accountId,
        member.id,
        newPermissions
      );
      if (result.message === 'error') {
        setPermissions(previousPermissions); // Revert on error
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
                        id={`${member.id}-${key}`}
                        checked={permissions[key] ?? false}
                        onCheckedChange={(checked) => handlePermissionChange(key, !!checked)}
                        disabled={isPending || isCurrentUser || isTargetOwner || isTargetAdmin}
                    />
                    <Label
                        htmlFor={`${member.id}-${key}`}
                        className="text-sm font-normal"
                    >
                        {labels[key]}
                    </Label>
                </div>
            ))}
        </div>
    </div>
  );

  if (isTargetOwner) {
     return (
        <div className="px-4 pb-4">
             <Separator />
             <Alert className="mt-4">
                <Shield className="h-4 w-4" />
                <AlertTitle>Proprietário</AlertTitle>
                <AlertDescription>
                    Proprietários têm acesso a todas as permissões.
                </AlertDescription>
            </Alert>
        </div>
    )
  }
  
  if (isTargetAdmin) {
     return (
        <div className="px-4 pb-4">
             <Separator />
             <Alert className="mt-4">
                <Shield className="h-4 w-4" />
                <AlertTitle>Administrador</AlertTitle>
                <AlertDescription>
                    Administradores herdam todas as permissões do proprietário da conta.
                </AlertDescription>
            </Alert>
        </div>
    )
  }

  // Filter out permissions based on role
  const filteredFeatureLabels = { ...featurePermissionLabels };
  let filteredScreenLabels = { ...screenPermissionLabels };
  if (isTargetViewer) {
    delete filteredFeatureLabels.canAccessNotificationsStudio;
    delete filteredScreenLabels.canAccessDumpsters;
    delete filteredScreenLabels.canAccessFleet;
    delete filteredScreenLabels.canAccessOperations;
  }

  return (
    <div className="px-4 pb-4">
       <Separator />
      <div className="space-y-6 py-4 relative">
        {renderPermissionGroup("Acesso às Telas", filteredScreenLabels)}
        <Separator />
        {renderPermissionGroup("Acesso a Funcionalidades", filteredFeatureLabels)}
         <Separator />
        {renderPermissionGroup("Permissões de Ações", actionsPermissionLabels)}
        
         {isPending && (
            <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-md">
                <Spinner />
            </div>
        )}
      </div>
    </div>
  );
}
