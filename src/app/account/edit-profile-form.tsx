
'use client';

import { useEffect, useTransition } from 'react';
import type { UserAccount } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { updateUserProfileAction } from '@/lib/actions';


export function EditProfileForm({ user }: { user: UserAccount }) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);

        startTransition(async () => {
            const result = await updateUserProfileAction(user.id, null, formData);
             if (result?.message === 'error') {
                 toast({
                    title: 'Erro ao Salvar',
                    description: result.error,
                    variant: 'destructive',
                });
            } else {
                 toast({
                    title: 'Sucesso!',
                    description: 'Seu perfil foi atualizado.',
                });
            }
        })
    }

    return (
        <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label htmlFor="name">Nome Completo</Label>
                    <Input id="name" name="name" defaultValue={user.name} required />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" defaultValue={user.email} disabled />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input id="phone" name="phone" defaultValue={user.phone ?? ''} />
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="address">Endereço</Label>
                <Textarea id="address" name="address" defaultValue={user.address ?? ''} />
            </div>
            <div className="flex justify-end pt-2">
                <Button type="submit" disabled={isPending}>
                    {isPending ? <Spinner size="small" /> : 'Salvar Alterações'}
                </Button>
            </div>
        </form>
    )
}
