
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

interface BeforeInstallPromptEvent extends Event {
    readonly platforms: Array<string>;
    readonly userChoice: Promise<{
        outcome: 'accepted' | 'dismissed';
        platform: string;
    }>;
    prompt(): Promise<void>;
}

const STORAGE_KEY = 'pwaInstallPromptDismissed';

export function InstallPwaPrompt() {
    const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            const hasBeenDismissed = localStorage.getItem(STORAGE_KEY);
            if (!hasBeenDismissed) {
                setPrompt(e as BeforeInstallPromptEvent);
                setIsOpen(true);
            }
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
        setIsOpen(false);
    };

    const handleDismiss = () => {
        localStorage.setItem(STORAGE_KEY, 'true');
        setIsOpen(false);
    }

    if (!isOpen || !prompt) {
        return null;
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent onPointerDownOutside={handleDismiss} onEscapeKeyDown={handleDismiss}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Download className="h-6 w-6" />
                        Instalar o LogiApp?
                    </DialogTitle>
                    <DialogDescription>
                        Tenha acesso mais rápido e uma experiência otimizada adicionando o LogiApp à sua tela inicial.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:justify-center">
                    <Button variant="outline" onClick={handleDismiss}>
                       <X className="mr-2 h-4 w-4" /> Agora não
                    </Button>
                    <Button onClick={handleInstallClick}>
                        <Download className="mr-2 h-4 w-4" /> Instalar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
