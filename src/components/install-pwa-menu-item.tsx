
'use client';

import { useState, useEffect } from 'react';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
    readonly platforms: Array<string>;
    readonly userChoice: Promise<{
        outcome: 'accepted' | 'dismissed';
        platform: string;
    }>;
    prompt(): Promise<void>;
}

export function InstallPwaMenuItem() {
    const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);

    useEffect(() => {
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setPrompt(e as BeforeInstallPromptEvent);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!prompt) return;
        
        await prompt.prompt();
        
        const { outcome } = await prompt.userChoice;
        if (outcome === 'accepted') {
            console.log('Usuário aceitou a instalação do PWA');
        } else {
            console.log('Usuário recusou a instalação do PWA');
        }
        setPrompt(null);
    };

    if (!prompt) {
        return null;
    }

    return (
        <DropdownMenuItem onClick={handleInstallClick}>
            <Download className="mr-2 h-4 w-4" />
            <span>Instalar App</span>
        </DropdownMenuItem>
    );
}
