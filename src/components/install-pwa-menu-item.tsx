
'use client';

import { useState, useEffect } from 'react';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Define a interface para o evento, pois o TypeScript padrão não a inclui.
interface BeforeInstallPromptEvent extends Event {
    readonly platforms: Array<string>;
    readonly userChoice: Promise<{
        outcome: 'accepted' | 'dismissed';
        platform: string;
    }>;
    prompt(): Promise<void>;
}

export function InstallPwaMenuItem() {
    // Estado para armazenar o evento de prompt de instalação.
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        // Manipulador para o evento 'beforeinstallprompt'.
        const handleBeforeInstallPrompt = (e: Event) => {
            // Previne que o mini-infobar padrão do Chrome apareça.
            e.preventDefault();
            // Armazena o evento para que ele possa ser disparado mais tarde.
            setDeferredPrompt(e as BeforeInstallPromptEvent);
        };

        // Adiciona o ouvinte de eventos quando o componente é montado.
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // Limpa o ouvinte quando o componente é desmontado.
        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        // Se o prompt de instalação não estiver disponível (botão desabilitado), não faz nada.
        // Essa verificação é uma segurança extra.
        if (!deferredPrompt) {
             toast({
                title: 'Instalação não disponível',
                description: 'O navegador não ofereceu uma opção de instalação ou o app já está instalado.',
                variant: 'destructive',
            });
            return;
        }

        // Mostra o prompt de instalação.
        deferredPrompt.prompt();

        // Aguarda o usuário responder ao prompt.
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            console.log('User accepted the install prompt');
        } else {
            console.log('User dismissed the install prompt');
        }
        
        // O prompt só pode ser usado uma vez. Limpamos o estado.
        setDeferredPrompt(null);
    };

    // O botão só fica habilitado se o 'deferredPrompt' tiver sido capturado.
    return (
        <DropdownMenuItem 
            onSelect={(e) => {
                e.preventDefault(); // Impede o fechamento do menu se precisarmos mostrar um toast.
                handleInstallClick();
            }}
            disabled={!deferredPrompt} // Habilita/desabilita o botão dinamicamente.
        >
            <Download className="mr-2 h-4 w-4" />
            <span>Instalar App</span>
        </DropdownMenuItem>
    );
}
