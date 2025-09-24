
'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { getGoogleAuthUrlAction } from '@/lib/actions';
import type { UserAccount } from '@/lib/types';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, ExternalLink } from 'lucide-react';

interface GoogleCalendarIntegrationProps {
    user: UserAccount;
}

export function GoogleCalendarIntegration({ user }: GoogleCalendarIntegrationProps) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const hasCalendarAccess = user.googleCalendar?.accessToken;

    const handleConnect = () => {
        startTransition(async () => {
            try {
                const result = await getGoogleAuthUrlAction();
                if (result.url) {
                    window.location.href = result.url;
                } else {
                    throw new Error(result.error || 'Não foi possível obter a URL de autenticação.');
                }
            } catch (error) {
                toast({
                    title: 'Erro de Conexão',
                    description: error instanceof Error ? error.message : 'Falha ao iniciar a conexão com o Google.',
                    variant: 'destructive',
                });
            }
        });
    };

    const handleDisconnect = () => {
        // A ser implementado
        console.log('disconnect');
    }

    if (hasCalendarAccess) {
        return (
             <Alert variant="success">
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Conectado ao Google Agenda!</AlertTitle>
                <AlertDescription>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <p>
                            Sua conta está conectada com {user.googleCalendar?.calendarId}.
                        </p>
                        <Button 
                            variant="destructive" 
                            size="sm" 
                            onClick={handleDisconnect} 
                            className="mt-2 sm:mt-0"
                            disabled
                        >
                            Desconectar
                        </Button>
                    </div>
                </AlertDescription>
            </Alert>
        )
    }

    return (
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
                Conecte sua conta do Google para criar eventos no seu Google Agenda automaticamente a partir das Ordens de Serviço.
            </p>
            <Button onClick={handleConnect} disabled={isPending}>
                {isPending ? <Spinner size="small" /> : <><ExternalLink className="mr-2 h-4 w-4" /> Conectar com Google Agenda</>}
            </Button>
        </div>
    );
}
