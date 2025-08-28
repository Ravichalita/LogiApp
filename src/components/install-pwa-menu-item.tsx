
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
    const { toast } = useToast();
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

    useEffect(() => {
        const handleBeforeInstallPrompt = (e: Event) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e as BeforeInstallPromptEvent);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // Listen for the appinstalled event
        const handleAppInstalled = () => {
            // Clear the deferredPrompt so it can't be prompted again
            setDeferredPrompt(null);
        };

        window.addEventListener('appinstalled', handleAppInstalled);


        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) {
            toast({
                title: 'Opção de instalação indisponível',
                description: 'O aplicativo já pode estar instalado ou a opção não está disponível no momento.',
                variant: 'destructive',
            });
            return;
        }

        // Show the install prompt
        deferredPrompt.prompt();
        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            console.log('User accepted the install prompt');
        } else {
            console.log('User dismissed the install prompt');
        }
    };

    return (
        <DropdownMenuItem
            onSelect={(e) => {
                e.preventDefault();
                handleInstallClick();
            }}
            disabled={!deferredPrompt}
        >
            <Download className="mr-2 h-4 w-4" />
            <span>Instalar App</span>
        </DropdownMenuItem>
    );
}
