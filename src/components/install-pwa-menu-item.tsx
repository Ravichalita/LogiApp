
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
        // Removendo a verificação conforme solicitado.
        // Isso pode causar um erro no console se o prompt não estiver disponível,
        // mas o botão tentará chamar a função de qualquer maneira.
        try {
            await prompt?.prompt();
            const { outcome } = await prompt!.userChoice;
            if (outcome === 'accepted') {
                console.log('Usuário aceitou a instalação do PWA');
            } else {
                console.log('Usuário recusou a instalação do PWA');
            }
            setPrompt(null);
        } catch (error) {
            console.warn("A solicitação de instalação não pôde ser exibida. Isso é esperado se o app já foi instalado ou se o navegador não é compatível.");
        }
    };

    return (
        <DropdownMenuItem onClick={handleInstallClick}>
            <Download className="mr-2 h-4 w-4" />
            <span>Instalar App</span>
        </DropdownMenuItem>
    );
}
