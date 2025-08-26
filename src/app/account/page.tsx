
'use client';

import { useAuth } from '@/context/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EditProfileForm } from './edit-profile-form';
import { DeleteSelfAccountButton } from './delete-self-account-button';
import { ResetPasswordCard } from './reset-password-card';
import { Separator } from '@/components/ui/separator';
import { TriangleAlert } from 'lucide-react';


export default function AccountPage() {
    const { userAccount, loading, isSuperAdmin } = useAuth();
    
    if (loading || !userAccount) {
        return (
             <div className="container mx-auto max-w-2xl py-8 px-4 md:px-6">
                 <div className="space-y-4">
                     <Skeleton className="h-8 w-1/4" />
                     <Skeleton className="h-5 w-1/2" />
                     <div className="pt-6">
                        <Skeleton className="h-40 w-full" />
                     </div>
                 </div>
            </div>
        )
    }

    return (
        <div className="container mx-auto max-w-2xl py-8 px-4 md:px-6">
            <div className="mb-8">
                <h1 className="text-3xl font-headline font-bold">Sua Conta</h1>
                <p className="text-muted-foreground mt-1">Gerencie suas informações pessoais e de acesso.</p>
            </div>
            
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Detalhes do Perfil</CardTitle>
                        <CardDescription>
                            Mantenha seus dados de contato atualizados.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <EditProfileForm user={userAccount} />
                    </CardContent>
                </Card>

                <ResetPasswordCard />

                {!isSuperAdmin && (
                    <Card className="border-destructive">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-destructive">
                                <TriangleAlert className="h-5 w-5" />
                                Encerrar Conta
                            </CardTitle>
                            <CardDescription>
                                Esta é uma ação permanente e não pode ser desfeita.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm mb-4">
                                Ao encerrar sua conta, seu usuário de acesso e todos os seus dados pessoais associados serão permanentemente excluídos. Seus aluguéis existentes não serão apagados, mas serão desvinculados do seu usuário.
                            </p>
                        <DeleteSelfAccountButton />
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}
