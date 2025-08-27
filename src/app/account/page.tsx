
'use client';

import { useAuth } from '@/context/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EditProfileForm } from './edit-profile-form';
import { DeleteSelfAccountButton } from './delete-self-account-button';
import { ResetPasswordCard } from './reset-password-card';
import { Separator } from '@/components/ui/separator';
import { TriangleAlert } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";


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
                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="delete-account" className="border border-destructive/50 rounded-lg bg-card">
                            <AccordionTrigger className="p-4 text-destructive hover:no-underline [&[data-state=open]>svg]:rotate-180">
                                <div className="flex items-center gap-2">
                                        <TriangleAlert className="h-5 w-5" />
                                        <span className="font-semibold">Encerrar Conta</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent>
                                <div className="px-4 pb-4 space-y-4">
                                    <p className="text-sm text-muted-foreground">
                                        Esta é uma ação permanente e irreversível. Ao encerrar sua conta, seu usuário de acesso e todos os seus dados pessoais associados serão permanentemente excluídos.
                                    </p>
                                    <DeleteSelfAccountButton />
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                )}
            </div>
        </div>
    )
}
