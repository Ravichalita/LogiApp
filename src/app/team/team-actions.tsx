

'use client';

import { useState, useTransition } from 'react';
import { MoreHorizontal, Trash2, Edit, UserCog, Shield } from 'lucide-react';
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
import type { Rental, UserAccount, UserRole } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { removeTeamMemberAction, updateUserRoleAction } from '@/lib/actions';
import { getActiveRentalsForUser } from '@/lib/data';
import { Spinner } from '@/components/ui/spinner';

export function TeamActions({ member }: { member: UserAccount }) {
  const { accountId, user, userAccount } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSubmitting, startTransition] = useTransition();
  const [isCheckingRentals, setIsCheckingRentals] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [assignedRentals, setAssignedRentals] = useState<Rental[]>([]);
  const { toast } = useToast();

  const isCurrentUser = user?.uid === member.id;
  const isOwner = member.role === 'owner';
  const isInvokerOwner = userAccount?.role === 'owner';

  const handleRoleChange = (role: string) => {
    if (!accountId || isCurrentUser || isOwner || !user) return;
    
    startTransition(async () => {
      const result = await updateUserRoleAction(user.uid, accountId, member.id, role as UserRole);
      if (result?.message === 'error') {
        toast({ title: 'Erro', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Sucesso', description: `Função de ${member.name} atualizada.` });
        setIsMenuOpen(false);
      }
    });
  };

  const checkRentalsAndOpenAlert = async () => {
    if (!accountId) return;
    setIsCheckingRentals(true);
    const rentals = await getActiveRentalsForUser(accountId, member.id);
    setAssignedRentals(rentals);
    setIsCheckingRentals(false);
    setIsAlertOpen(true);
  }

  const handleRemoveMember = () => {
    if (!accountId || isCurrentUser || isOwner) return;
    startTransition(async () => {
        const result = await removeTeamMemberAction(accountId, member.id);
         if (result?.message === 'error') {
            toast({ title: 'Erro', description: result.error, variant: 'destructive' });
        } else {
            toast({ title: 'Sucesso', description: `${member.name} foi removido da equipe.` });
        }
        setIsAlertOpen(false);
    });
  };
  
  if (isOwner) {
    return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="h-4 w-4" />
            <span>Proprietário</span>
        </div>
    )
  }

  // Only owners can manage team members' roles and remove them.
  if (!isInvokerOwner) {
      return null;
  }

  return (
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0" disabled={isCurrentUser || isOwner}>
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
                    Visualizador
                </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <AlertDialogTrigger asChild>
              <DropdownMenuItem 
                className="text-destructive" 
                onSelect={(e) => {
                  e.preventDefault();
                  checkRentalsAndOpenAlert();
                }}
                disabled={isCheckingRentals}
              >
                {isCheckingRentals ? 'Verificando...' : <><Trash2 className="mr-2 h-4 w-4" /> Remover da Equipe</>}
              </DropdownMenuItem>
            </AlertDialogTrigger>
          </DropdownMenuContent>
        </DropdownMenu>

        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover {member.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. O usuário perderá o acesso a todos os dados desta conta.
              {assignedRentals.length > 0 && (
                <span className="font-bold text-destructive block mt-2">
                  Atenção: {member.name} tem {assignedRentals.length} aluguel(s) ativo(s). Ao remover o usuário, esses aluguéis serão automaticamente transferidos para o proprietário da conta.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMember} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">
              {isSubmitting ? 'Removendo...' : 'Sim, remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
  );
}
