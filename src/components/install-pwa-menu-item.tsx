
'use client';

import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';

export function InstallPwaMenuItem() {
    const { deferredPrompt, setDeferredPrompt } = useAuth();
    const { toast } = useToast();

    const handleInstallClick = async () => {
        if (!deferredPrompt) {
             toast({
                title: 'Opção de instalação indisponível',
                description: 'A instalação do aplicativo não está disponível no momento.',
                variant: 'destructive',
            });
            return;
        }

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            console.log('User accepted the install prompt');
        } else {
            console.log('User dismissed the install prompt');
        }
        // Clear the prompt once it's used
        setDeferredPrompt(null);
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
