
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import type { UserAccount } from '@/lib/types';
import { getSuperAdminsAction } from '@/lib/data-server-actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, UserCog, PlusCircle } from 'lucide-react';
import { SuperAdminActions } from './super-admin-actions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { AddSuperAdminForm } from './add-super-admin-form';

function SuperAdminListSkeleton() {
    return (
        <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
                <div key={i} className="border rounded-lg shadow-sm p-4 space-y-2 bg-card">
                    <div className="flex items-center justify-between">
                        <div className='space-y-1'>
                             <Skeleton className="h-5 w-32" />
                            <Skeleton className="h-4 w-40" />
                        </div>
                        <Skeleton className="h-8 w-8" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                </div>
            ))}
        </div>
    );
}


export default function SuperAdminsPage() {
    const { user, isSuperAdmin, loading: authLoading } = useAuth();
    const [superAdmins, setSuperAdmins] = useState<UserAccount[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

    useEffect(() => {
        if (authLoading) return;
        if (!isSuperAdmin || !user) {
            setLoadingData(false);
            return;
        };

        async function fetchData() {
            setLoadingData(true);
            const admins = await getSuperAdminsAction();
            setSuperAdmins(admins);
            setLoadingData(false);
        }
        
        fetchData();

    }, [isSuperAdmin, authLoading, user]);

    const isLoading = authLoading || loadingData;

    if (!isLoading && !isSuperAdmin) {
         return (
            <div className="container mx-auto py-8 px-4 md:px-6">
                 <Alert variant="destructive">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>Acesso Negado</AlertTitle>
                    <AlertDescription>
                       Você não tem permissão para visualizar esta página.
                    </AlertDescription>
                </Alert>
            </div>
        )
    }

    return (
        <div className="container mx-auto py-8 px-4 md:px-6">
            <div className="mb-8">
                <h1 className="text-3xl font-headline font-bold">Gerenciar Super Admins</h1>
                <p className="text-muted-foreground mt-1">
                    Adicione, edite ou remova outros Super Admins.
                </p>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Contas de Super Admin</CardTitle>
                </CardHeader>
                 <CardContent>
                    {isLoading ? <SuperAdminListSkeleton /> : (
                         <div className="space-y-4">
                            {superAdmins.length > 0 ? superAdmins.map(admin => (
                                <div key={admin.id} className="border rounded-lg p-4 flex items-center justify-between bg-muted/50">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 bg-primary/10 rounded-full">
                                            <UserCog className="h-6 w-6 text-primary" />
                                        </div>
                                        <div>
                                            <p className="font-medium">{admin.name}</p>
                                            <p className="text-sm text-muted-foreground">{admin.email}</p>
                                        </div>
                                    </div>
                                    <SuperAdminActions admin={admin} />
                                </div>
                            )) : (
                                 <div className="text-center py-16">
                                    <p className="text-muted-foreground">Nenhum Super Admin encontrado.</p>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="flex justify-end mt-6">
                 <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Adicionar Super Admin
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Adicionar Novo Super Admin</DialogTitle>
                            <DialogDescription>
                                Preencha os dados abaixo. Uma senha forte será gerada automaticamente e deverá ser compartilhada com o novo usuário.
                            </DialogDescription>
                        </DialogHeader>
                        <AddSuperAdminForm onSave={() => setIsAddDialogOpen(false)} />
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
