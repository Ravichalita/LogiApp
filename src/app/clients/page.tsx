
'use client';

import { useEffect, useState, useMemo } from 'react';
import { getClients } from '@/lib/data';
import { ClientActions } from './client-actions';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Mail, FileText, MapPin, Phone, Search, Fingerprint, Plus, Minus, ShieldAlert } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import type { Client } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

function ClientListSkeleton() {
    return (
        <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
                 <div key={i} className="border rounded-lg shadow-sm p-4 bg-card">
                    <div className="flex items-center justify-between">
                        <Skeleton className="h-5 w-40" />
                        <Skeleton className="h-8 w-8" />
                    </div>
                     <Skeleton className="h-4 w-32 mt-2" />
                 </div>
            ))}
        </div>
    );
}


export default function ClientsPage() {
  const { accountId, userAccount, isSuperAdmin, loading: authLoading } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const router = useRouter();

  const canAccess = isSuperAdmin || userAccount?.permissions?.canAccessClients;

  useEffect(() => {
    if (authLoading) return;
    if (!canAccess) {
      setLoading(false);
      return;
    }

    if (accountId) {
      const unsubscribe = getClients(accountId, (clients) => {
        setClients(clients);
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      setClients([]);
      setLoading(false);
    }
  }, [accountId, authLoading, canAccess]);

  const filteredClients = useMemo(() => {
    if (!searchTerm) {
      return clients;
    }
    return clients.filter(client =>
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (client.cpfCnpj && client.cpfCnpj.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [clients, searchTerm]);

  const handleCopyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone).then(() => {
      toast({
        title: 'Copiado!',
        description: 'Número de telefone copiado para a área de transferência.',
      });
    }).catch(err => {
      console.error('Failed to copy text: ', err);
       toast({
        title: 'Erro',
        description: 'Não foi possível copiar o número.',
        variant: 'destructive',
      });
    });
  };

  const handleClientAdded = () => {
    setSearchTerm('');
  };

  const isLoading = authLoading || (loading && canAccess);

  if (!isLoading && !canAccess) {
    return (
        <div className="container mx-auto py-8 px-4 md:px-6">
            <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Acesso Negado</AlertTitle>
                <AlertDescription>
                    Você não tem permissão para visualizar esta página.
                </AlertDescription>
            </Alert>
        </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
        <h1 className="text-3xl font-headline font-bold mb-8">Gerenciar Clientes</h1>
        <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
                placeholder="Buscar por nome, telefone, CPF/CNPJ..."
                className="pl-9 bg-card"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
        
        {isLoading ? <ClientListSkeleton /> : (
            <Accordion type="multiple" className="space-y-4">
                {filteredClients.length > 0 ? filteredClients.map(client => (
                <AccordionItem value={client.id} key={client.id} className="border rounded-lg shadow-sm bg-card">
                    <div className="p-4">
                    <div className="flex items-center justify-between">
                        <div className="font-medium">{client.name}</div>
                        <ClientActions client={client} />
                    </div>
                    <Button variant="ghost" className="text-sm text-muted-foreground mt-1 flex items-center gap-2 p-0 h-auto hover:bg-transparent" onClick={() => handleCopyPhone(client.phone)}>
                        <Phone className="h-4 w-4 shrink-0"/> <span>{client.phone}</span>
                    </Button>
                    <AccordionTrigger className="text-sm text-primary hover:no-underline p-0 pt-2 justify-start group" hideChevron>
                         <Plus className="h-4 w-4 mr-1 transition-transform duration-200 group-data-[state=open]:hidden" />
                         <Minus className="h-4 w-4 mr-1 transition-transform duration-200 hidden group-data-[state=open]:block" />
                        Ver Detalhes
                    </AccordionTrigger>
                    </div>
                    <AccordionContent>
                    <Separator />
                    <div className="space-y-4 p-4 bg-muted/50">
                        {client.cpfCnpj && (
                        <div className="flex items-start gap-3">
                            <Fingerprint className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                            <div className="flex flex-col">
                            <span className="text-sm text-muted-foreground">CPF/CNPJ</span>
                            <span className="font-medium">{client.cpfCnpj}</span>
                            </div>
                        </div>
                        )}
                        <div className="flex items-start gap-3">
                        <MapPin className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                        <div className="flex flex-col">
                            <span className="text-sm text-muted-foreground">Endereço Principal</span>
                            <span className="font-medium">{client.address}</span>
                            {client.latitude && client.longitude && (
                            <Link href={`https://www.google.com/maps?q=${client.latitude},${client.longitude}`} target="_blank" className="text-xs text-primary hover:underline mt-1">
                                Ver no mapa
                            </Link>
                            )}
                        </div>
                        </div>
                        {client.email && (
                        <div className="flex items-start gap-3">
                            <Mail className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                            <div className="flex flex-col">
                            <span className="text-sm text-muted-foreground">Email</span>
                            <span className="font-medium">{client.email}</span>
                            </div>
                        </div>
                        )}
                        {client.observations && (
                        <div className="flex items-start gap-3">
                            <FileText className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                            <div className="flex flex-col">
                            <span className="text-sm text-muted-foreground">Observações</span>
                            <p className="font-medium whitespace-pre-wrap">{client.observations}</p>
                            </div>
                        </div>
                        )}
                        {!client.email && !client.observations && !client.cpfCnpj &&(
                            <p className="text-sm text-muted-foreground text-center py-2">Nenhuma informação adicional cadastrada.</p>
                        )}
                    </div>
                    </AccordionContent>
                </AccordionItem>
                )) : (
                <div className="text-center py-16 bg-card rounded-lg border">
                    <p className="text-muted-foreground">Nenhum cliente cadastrado ainda.</p>
                </div>
                )}
            </Accordion>
        )}
    </div>
  );
}
