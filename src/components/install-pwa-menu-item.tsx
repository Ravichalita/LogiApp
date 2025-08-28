
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
            // Previne que o mini-infobar apareça no Chrome
            e.preventDefault();
            // Guarda o evento para que ele possa ser acionado mais tarde.
            setDeferredPrompt(e as BeforeInstallPromptEvent);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        // Se o deferredPrompt não estiver disponível, não faz nada.
        // Isso não deveria acontecer por causa da renderização condicional abaixo.
        if (!deferredPrompt) {
            return;
        }

        // Mostra o prompt de instalação
        await deferredPrompt.prompt();

        // Espera o usuário responder ao prompt
        const { outcome } = await deferredPrompt.userChoice;
        
        // Opcionalmente, envie analytics sobre o resultado
        console.log(`User response to the install prompt: ${outcome}`);

        // O prompt só pode ser usado uma vez, então limpamos o estado
        setDeferredPrompt(null);
    };

    // Só renderiza o item do menu se o prompt de instalação estiver disponível
    if (!deferredPrompt) {
        return null;
    }

    return (
        <DropdownMenuItem onSelect={handleInstallClick}>
            <Download className="mr-2 h-4 w-4" />
            <span>Instalar App</span>
        </DropdownMenuItem>
    );
}
