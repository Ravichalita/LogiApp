
'use client';

import { useState, useEffect, useTransition } from 'react';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Bell, BellRing, BellOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { sendNotification } from '@/lib/notifications'; 
import { setupFcm } from '@/lib/firebase-client';
import { Spinner } from './ui/spinner';

export function TestNotificationMenuItem() {
    const { toast } = useToast();
    const { user } = useAuth();
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        if ('Notification' in window) {
            setPermission(Notification.permission);
        }
    }, []);

    const handleTestNotification = async () => {
        if (!user) {
            toast({ title: 'Erro', description: 'Você precisa estar logado para testar as notificações.', variant: 'destructive' });
            return;
        }

        if (permission === 'granted') {
            startTransition(async () => {
                toast({ title: 'Enviando Notificação...', description: 'Você deve receber um alerta em breve.'});
                await sendNotification({
                    userId: user.uid,
                    title: 'Teste de Notificação ✅',
                    body: 'Se você recebeu isso, suas notificações estão funcionando!',
                });
            });
        } else if (permission === 'default') {
            try {
                const newPermission = await Notification.requestPermission();
                setPermission(newPermission);
                if (newPermission === 'granted') {
                    toast({ title: 'Permissão Concedida!', description: 'Agora vamos registrar seu dispositivo e enviar um teste.' });
                    await setupFcm(user.uid); // Ensure device is registered
                    handleTestNotification(); // Re-run to send the notification
                } else {
                     toast({ title: 'Permissão Negada', description: 'Você não receberá notificações.', variant: 'destructive' });
                }
            } catch (error) {
                console.error("Error requesting notification permission:", error);
                toast({ title: 'Erro', description: 'Não foi possível solicitar permissão.', variant: 'destructive' });
            }
        } else if (permission === 'denied') {
            toast({
                title: 'Notificações Bloqueadas',
                description: 'Você precisa permitir as notificações nas configurações do seu navegador ou do aplicativo para continuar.',
                variant: 'destructive',
                duration: 10000,
            });
        }
    };

    const getMenuContent = () => {
        switch (permission) {
            case 'granted':
                return { icon: <BellRing className="mr-2 h-4 w-4 text-green-500" />, text: 'Testar Notificações' };
            case 'denied':
                return { icon: <BellOff className="mr-2 h-4 w-4 text-destructive" />, text: 'Notificações Bloqueadas' };
            case 'default':
            default:
                return { icon: <Bell className="mr-2 h-4 w-4" />, text: 'Ativar Notificações' };
        }
    };

    const { icon, text } = getMenuContent();

    return (
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleTestNotification(); }} disabled={isPending}>
            {isPending ? <Spinner size="small" className="mr-2" /> : icon}
            <span>{text}</span>
        </DropdownMenuItem>
    );
}
