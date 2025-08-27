'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import type { Client } from '@/lib/types';
import { getDoc, doc } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase-client';
import { EditClientForm } from './edit-client-form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export default function EditClientPage() {
  const params = useParams();
  const clientId = params.id as string;
  const { accountId } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accountId || !clientId) {
        if (!accountId) setError("A conta não foi identificada.");
        if (!clientId) setError("O cliente não foi identificado.");
        setLoading(false);
        return;
    };

    const { db } = getFirebase();
    const clientRef = doc(db, `accounts/${accountId}/clients/${clientId}`);

    const fetchClient = async () => {
        setLoading(true);
        setError(null);
        try {
            const docSnap = await getDoc(clientRef);
            if (docSnap.exists()) {
                setClient({ id: docSnap.id, ...docSnap.data() } as Client);
            } else {
                setError('Cliente não encontrado.');
            }
        } catch (e) {
            console.error(e);
            setError('Falha ao carregar os dados do cliente.');
        } finally {
            setLoading(false);
        }
    };

    fetchClient();

  }, [accountId, clientId]);


  if (loading) {
    return (
        <div className="container mx-auto max-w-2xl py-8 px-4 md:px-6">
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                     <Skeleton className="h-4 w-20" />
                     <Skeleton className="h-10 w-full" />
                  </div>
                   <div className="space-y-2">
                     <Skeleton className="h-4 w-20" />
                     <Skeleton className="h-10 w-full" />
                  </div>
                   <div className="space-y-2">
                     <Skeleton className="h-4 w-20" />
                     <Skeleton className="h-10 w-full" />
                  </div>
                </CardContent>
            </Card>
        </div>
    )
  }

  if (error) {
      return (
          <div className="container mx-auto max-w-2xl py-8 px-4 md:px-6">
               <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Erro</AlertTitle>
                    <AlertDescription>
                       {error}
                    </AlertDescription>
                </Alert>
          </div>
      )
  }

  return (
    <div className="container mx-auto max-w-2xl py-8 px-4 md:px-6">
        <Card>
            <CardHeader>
                <CardTitle className="font-headline text-2xl">Editar Cliente</CardTitle>
                <CardDescription>Ajuste as informações do cliente e salve as alterações.</CardDescription>
            </CardHeader>
            <CardContent>
                {client && <EditClientForm client={client} />}
            </CardContent>
        </Card>
    </div>
  )
}
