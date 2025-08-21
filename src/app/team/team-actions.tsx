
'use client';
import { useState, useTransition } from 'react';
import { removeUserFromAccount, updateUserRoleStatus } from '@/lib/actions';
import { MoreHorizontal, Trash2, UserCog, Check, Shield, User, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { UserAccount, UserRole, UserStatus } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { Spinner } from '@/components/ui/spinner';

interface TeamActionsProps {
    member: UserAccount;
    currentUser: UserAccount | null;
}

export function TeamActions({ member, currentUser }: TeamActionsProps) {
  const { accountId } = useAuth();
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const isCurrentUser = currentUser?.id === member.id;

  const handleRoleChange = (role: UserRole) => {
    if (!accountId || isCurrentUser) return;
    startTransition(async () => {
      const result = await updateUserRoleStatus(accountId, member.id, role, member.status);
      if (result.message === 'error') {
        toast({ title: 'Erro', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Sucesso', description: 'Função do usuário atualizada.' });
      }
    });
  };
  
  const handleStatusChange = (status: UserStatus) => {
    if (!accountId || isCurrentUser) return;
    startTransition(async () => {
      const result = await updateUserRoleStatus(accountId, member.id, member.role, status);
      if (result.message === 'error') {
        toast({ title: 'Erro', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Sucesso', description: 'Status do usuário atualizado.' });
      }
    });
  };
  
  const handleDelete = () => {
    if (!accountId || isCurrentUser) return;
    startTransition(async () => {
      const result = await removeUserFromAccount(accountId, member.id);
      if (result.message === 'error') {
        toast({ title: 'Erro', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Sucesso', description: 'Usuário removido da conta.' });
      }
    });
  }

  return (
    <AlertDialog>
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0" disabled={isCurrentUser}>
                <span className="sr-only">Abrir menu</span>
                <MoreHorizontal className="h-4 w-4" />
            </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Ações</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                        <UserCog className="mr-2 h-4 w-4" />
                        <span>Alterar Função</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                             <DropdownMenuRadioGroup value={member.role} onValueChange={(val) => handleRoleChange(val as UserRole)}>
                                <DropdownMenuRadioItem value="admin">
                                    <Shield className="mr-2 h-4 w-4" />
                                    Admin
                                </DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="viewer">
                                    <User className="mr-2 h-4 w-4" />
                                    Viewer
                                </DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                        </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                </DropdownMenuSub>
                 <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                        <Check className="mr-2 h-4 w-4" />
                        <span>Alterar Status</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                             <DropdownMenuRadioGroup value={member.status} onValueChange={(val) => handleStatusChange(val as UserStatus)}>
                                <DropdownMenuRadioItem value="ativo">Ativo</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="inativo">Inativo</DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                        </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <AlertDialogTrigger asChild>
                    <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        <span>Remover</span>
                    </DropdownMenuItem>
                </AlertDialogTrigger>
            </DropdownMenuContent>
        </DropdownMenu>

        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
                <TriangleAlert className="h-6 w-6 text-destructive" />
                Você tem certeza?
            </AlertDialogTitle>
            <AlertDialogDescription>
                Essa ação não pode ser desfeita. Isso irá remover permanentemente o usuário <strong>{member.name}</strong> da sua conta e do sistema de autenticação.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isPending} className="bg-destructive hover:bg-destructive/90">
                 {isPending ? <Spinner size="small" /> : 'Sim, Remover'}
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
  );
}
