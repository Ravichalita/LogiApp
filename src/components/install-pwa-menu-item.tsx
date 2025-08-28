
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
        // O prompt não deve ser nulo aqui por causa da renderização condicional,
        // mas adicionamos uma verificação por segurança.
        if (!deferredPrompt) {
            return;
        }

        // Mostra o prompt de instalação
        deferredPrompt.prompt();

        // Espera o usuário responder ao prompt
        // Opcionalmente, pode-se usar o resultado para analytics
        await deferredPrompt.userChoice;
        
        // O prompt só pode ser usado uma vez. Limpamos o estado para que
        // o botão "Instalar" não seja mais exibido.
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
