'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { getAllAccountsAction } from '@/lib/actions';
import type { Account } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LogOut } from 'lucide-react';
import { Button } from './ui/button';

export function AccountSwitcher() {
  const {
    user,
    isSuperAdmin,
    impersonatedAccountId,
    realAccountId,
    setImpersonatedAccountId,
    clearImpersonation
  } = useAuth();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (isSuperAdmin && user) {
      setIsLoading(true);
      getAllAccountsAction(user.uid)
        .then(fetchedAccounts => {
          if (isMounted) {
             // Sort accounts by name for better usability
            const sortedAccounts = fetchedAccounts.sort((a, b) => (a.companyName || '').localeCompare(b.companyName || ''));
            setAccounts(sortedAccounts);
            setError(null);
          }
        })
        .catch(err => {
          if (isMounted) {
            console.error("Failed to fetch accounts:", err);
            setError("Falha ao carregar contas.");
          }
        })
        .finally(() => {
          if (isMounted) {
            setIsLoading(false);
          }
        });
    }

    return () => {
      isMounted = false;
    };
  }, [isSuperAdmin, user]);

  if (!isSuperAdmin) {
    return null;
  }

  const handleValueChange = (newAccountId: string) => {
    if (newAccountId === realAccountId) {
      clearImpersonation();
    } else {
      setImpersonatedAccountId(newAccountId);
    }
  };

  const currentAccountName = impersonatedAccountId
    ? accounts.find(acc => acc.id === impersonatedAccountId)?.companyName
    : 'Visão Super Admin';

  const triggerText = isLoading
    ? 'Carregando contas...'
    : error || currentAccountName || 'Selecionar Conta';

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-background">
      <Select
        value={impersonatedAccountId || realAccountId || ''}
        onValueChange={handleValueChange}
        disabled={isLoading || !!error}
      >
        <SelectTrigger className="w-full md:w-[250px] text-sm font-semibold">
          <SelectValue placeholder="Selecionar conta do cliente">
            {triggerText}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
            <SelectItem value={realAccountId || ''}>
                Visão Super Admin
            </SelectItem>
          {accounts.map(account => (
            <SelectItem key={account.id} value={account.id}>
              {account.companyName || 'Conta sem nome'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {impersonatedAccountId && (
        <Button
          variant="ghost"
          size="icon"
          onClick={clearImpersonation}
          title="Sair da visão do cliente"
        >
          <LogOut className="h-4 w-4 text-destructive" />
        </Button>
      )}
    </div>
  );
}
