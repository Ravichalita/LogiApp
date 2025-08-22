
'use client';

import { useState, useTransition } from 'react';
import { MoreHorizontal, Trash2, Edit, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem
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
import type { UserAccount, UserRole } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { removeTeamMemberAction, updateUserRoleAction } from '@/lib/actions';

export function TeamActions({ member }: { member: UserAccount }) {
  const { accountId, user } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSubmitting, startTransition] = useTransition();
  const { toast } = useToast();

  const isCurrentUser = user?.uid === member.id;

  const handleRoleChange = (role: string) => {
    if (!accountId || isCurrentUser) return;
    startTransition(async () => {
      const result = await updateUserRoleAction(accountId, member.id, role as UserRole);
      if (result?.message === 'error') {
        toast({ title: 'Erro', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Sucesso', description: `Função de ${member.name} atualizada.` });
        setIsMenuOpen(false);
      }
    });
  };

  const handleRemoveMember = () => {
    if (!accountId || isCurrentUser) return;
    startTransition(async () => {
        const result = await removeTeamMemberAction(accountId, member.id);
         if (result?.message === 'error') {
            toast({ title: 'Erro', description: result.error, variant: 'destructive' });
        } else {
            toast({ title: 'Sucesso', description: `${member.name} foi removido da equipe.` });
        }
    });
  };

  return (
      <AlertDialog>
        <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0" disabled={isCurrentUser}>
              <span className="sr-only">Abrir menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Gerenciar Função</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={member.role} onValueChange={handleRoleChange} disabled={isSubmitting}>
                 <DropdownMenuRadioItem value="admin">
                    Admin
                </DropdownMenuRadioItem>
                 <DropdownMenuRadioItem value="viewer">
                    Viewer
                </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <AlertDialogTrigger asChild>
              <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}>
                <Trash2 className="mr-2 h-4 w-4" />
                Remover da Equipe
              </DropdownMenuItem>
            </AlertDialogTrigger>
          </DropdownMenuContent>
        </DropdownMenu>

        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover {member.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. O usuário perderá o acesso a todos os dados desta conta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMember} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">
              {isSubmitting ? 'Removendo...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
  );
}
