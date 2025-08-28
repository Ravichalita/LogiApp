
'use client';

import { useState, useEffect } from 'react';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BeforeInstallPromptEvent extends Event {
    readonly platforms: Array<string>;
    readonly userChoice: Promise<{
        outcome: 'accepted' | 'dismissed';
        platform: string;
    }>;
    prompt(): Promise<void>;
}

export function InstallPwaMenuItem() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) {
            toast({
                title: 'App já instalado ou indisponível',
                description: 'A instalação não está disponível no momento. O app pode já estar instalado ou o navegador não é compatível.',
                variant: 'destructive',
            })
            return;
        }

        deferredPrompt.prompt();

        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            console.log('User accepted the install prompt');
        } else {
            console.log('User dismissed the install prompt');
        }
        
        setDeferredPrompt(null);
    };

    return (
        <DropdownMenuItem onSelect={(e) => {
            e.preventDefault(); // Prevent menu from closing if we need to show a toast
            handleInstallClick();
        }}
        disabled={!deferredPrompt}
        >
            <Download className="mr-2 h-4 w-4" />
            <span>Instalar App</span>
        </DropdownMenuItem>
    );
}
