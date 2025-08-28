
'use client';

import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { X, Download } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/card';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPwaPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            const promptEvent = e as BeforeInstallPromptEvent;
            
            setDeferredPrompt(promptEvent);
            setIsVisible(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            console.log('PWA installation accepted');
        } else {
            console.log('PWA installation dismissed');
        }
        setDeferredPrompt(null);
        setIsVisible(false);
    };

    const handleDismiss = () => {
        setIsVisible(false);
    };

    if (!isVisible || !deferredPrompt) {
        return null;
    }

    return (
        <div className="fixed bottom-0 right-0 left-0 sm:left-auto sm:bottom-4 sm:right-4 z-50 p-4">
            <Card className="shadow-2xl animate-in slide-in-from-bottom-10">
                <CardHeader className="p-4">
                    <CardTitle className="flex items-center justify-between text-base">
                        Instalar o App CaçambaControl
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleDismiss}>
                            <X className="h-4 w-4" />
                            <span className="sr-only">Fechar</span>
                        </Button>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    <p className="text-sm text-muted-foreground">
                        Tenha acesso rápido e fácil ao aplicativo adicionando-o à sua tela inicial.
                    </p>
                </CardContent>
                <CardFooter className="p-4 pt-0">
                    <Button className="w-full" onClick={handleInstall}>
                        <Download className="mr-2 h-4 w-4" />
                        Instalar
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
