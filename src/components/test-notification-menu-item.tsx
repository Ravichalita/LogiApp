
'use client';

import { useState, useEffect, useTransition } from 'react';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Bell, BellRing, BellOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from './ui/spinner';
import { cn } from '@/lib/utils';

export function TestNotificationMenuItem() {
    const { toast } = useToast();
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        if ('Notification' in window) {
            setPermission(Notification.permission);
        }
    }, []);

    const showLocalNotification = () => {
        navigator.serviceWorker.ready.then((registration) => {
            registration.showNotification('Teste de Notificação ✅', {
                body: 'Se você pode ver isso, suas notificações estão funcionando!',
                icon: '/favicon.ico',
            });
        }).catch(err => {
             console.error("Service Worker not ready or notification failed: ", err);
             toast({
               title: 'Erro ao exibir notificação',
               description: 'Não foi possível criar a notificação de teste.',
               variant: 'destructive',
            });
        });
    };

    const handleTestNotification = () => {
        if (!('Notification' in window)) {
            toast({
                title: 'Navegador incompatível',
                description: 'Este navegador não suporta notificações de desktop.',
                variant: 'destructive'
            });
            return;
        }
        
        const currentPermission = Notification.permission;
        setPermission(currentPermission);

        if (currentPermission === 'granted') {
            showLocalNotification();
            return;
        }

        if (currentPermission === 'denied') {
            toast({
                title: 'Notificações Bloqueadas',
                description: 'Você precisa permitir as notificações nas configurações do seu navegador ou do aplicativo para continuar.',
                variant: 'destructive',
                duration: 10000,
            });
            return;
        }
        
        if (currentPermission === 'default') {
            startTransition(async () => {
                 try {
                    const newPermission = await Notification.requestPermission();
                    setPermission(newPermission);
                    if (newPermission === 'granted') {
                        toast({
                            title: 'Permissão Concedida!',
                            description: 'A notificação de teste será exibida em seguida.'
                        });
                        showLocalNotification();
                    } else {
                        toast({
                            title: 'Permissão Negada',
                            description: 'Você não receberá notificações.',
                            variant: 'destructive'
                        });
                    }
                } catch (error) {
                    console.error("Error requesting notification permission:", error);
                    toast({
                        title: 'Erro',
                        description: 'Não foi possível solicitar permissão.',
                        variant: 'destructive'
                    });
                }
            });
        }
    };
    
    const getMenuContent = () => {
        switch (permission) {
            case 'granted':
                return { icon: <BellRing className="mr-2 h-4 w-4 text-green-500" />, text: 'Testar Notificações' };
            case 'denied':
                return { icon: <BellOff className="mr-2 h-4 w-4 text-[#ff1c00] dark:text-[#ff1c00]" />, text: 'Notificações Bloqueadas' };
            case 'default':
            default:
                return { icon: <Bell className="mr-2 h-4 w-4" />, text: 'Ativar Notificações' };
        }
    };

    const { icon, text } = getMenuContent();

    return (
        <DropdownMenuItem 
            onSelect={(e) => {
                handleTestNotification();
            }} 
            disabled={isPending}
        >
            {isPending ? <Spinner size="small" className="mr-2" /> : icon}
            <span>{text}</span>
        </DropdownMenuItem>
    );
}
