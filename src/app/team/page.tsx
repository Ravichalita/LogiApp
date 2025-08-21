
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/auth-context';
import { getTeamMembers } from '@/lib/data';
import type { UserAccount } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { TeamActions } from './team-actions';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

function TeamTableSkeleton() {
  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Função</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...Array(3)].map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <div className="flex flex-col">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-40 mt-1" />
                </div>
              </TableCell>
              <TableCell><Skeleton className="h-6 w-20" /></TableCell>
              <TableCell><Skeleton className="h-5 w-16" /></TableCell>
              <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function TeamPage() {
  const { accountId, user, userAccount } = useAuth();
  const [members, setMembers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const isAdmin = userAccount?.role === 'admin';

  useEffect(() => {
    if (accountId && isAdmin) {
      const unsubscribe = getTeamMembers(accountId, (users) => {
        setMembers(users);
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      setLoading(false);
    }
  }, [accountId, isAdmin]);
  
  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
  }, [members]);

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6">
        <div className="flex items-center justify-between mb-6">
          <div>
              <h1 className="text-3xl font-headline font-bold">Gerenciar Equipe</h1>
              <p className="text-muted-foreground">Adicione, remova e gerencie as permissões dos usuários.</p>
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <TeamTableSkeleton />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6 text-center">
        <h1 className="text-2xl font-bold">Acesso Negado</h1>
        <p className="text-muted-foreground mt-2">Você não tem permissão para visualizar esta página.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <div className="flex items-center justify-between mb-6">
        <div>
            <h1 className="text-3xl font-headline font-bold">Gerenciar Equipe</h1>
            <p className="text-muted-foreground">Adicione, remova e gerencie as permissões dos usuários.</p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Membros da Equipe</CardTitle>
          <CardDescription>
            {sortedMembers.length} usuário(s) nesta conta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedMembers.length > 0 ? (
                  sortedMembers.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="font-medium">{member.name || member.email}</div>
                        <div className="text-sm text-muted-foreground">{member.email}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={member.status === 'ativo' ? 'success' : 'secondary'}>
                          {member.status === 'ativo' ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="capitalize">{member.role}</TableCell>
                      <TableCell className="text-right">
                        <TeamActions member={member} currentUser={userAccount}/>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      Nenhum membro na equipe ainda.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
