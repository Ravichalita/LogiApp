
'use client';

import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { X, Download } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/card';
import { useAuth } from '@/context/auth-context';

export function InstallPwaPrompt() {
    const { deferredPrompt, handleInstall, isPwaInstalled } = useAuth();
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (deferredPrompt && !isPwaInstalled) {
            const dismissed = localStorage.getItem('pwaInstallDismissed');
            if (!dismissed) {
                setIsVisible(true);
            }
        } else {
            setIsVisible(false);
        }
    }, [deferredPrompt, isPwaInstalled]);

    const handleDismiss = () => {
        localStorage.setItem('pwaInstallDismissed', 'true');
        setIsVisible(false);
    };
    
    const handleInstallClick = () => {
        handleInstall();
        setIsVisible(false);
    }

    if (!isVisible) {
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
                    <Button className="w-full" onClick={handleInstallClick}>
                        <Download className="mr-2 h-4 w-4" />
                        Instalar
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
