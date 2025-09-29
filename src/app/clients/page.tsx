
'use client';

import { useEffect, useState, useMemo } from 'react';
import { getClients, getRentals, getPopulatedOperations } from '@/lib/data';
import { getCompletedRentals, getCompletedOperations } from '@/lib/data-server-actions';
import { ClientActions } from './client-actions';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Mail, FileText, MapPin, Phone, Search, Fingerprint, Plus, Minus, ShieldAlert, History, UserX, Star, CheckCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import type { Client, CompletedRental, Rental, PopulatedOperation, CompletedOperation } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { getFirebase } from '@/lib/firebase-client';
import { collection, onSnapshot } from 'firebase/firestore';
import { parseISO, differenceInDays, addDays } from 'date-fns';


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

function ClientList({ clients }: { clients: Client[] }) {
    const { toast } = useToast();

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

    if (clients.length === 0) {
        return <p className="text-sm text-muted-foreground text-center py-4">Nenhum cliente encontrado.</p>
    }

    return (
        <Accordion type="multiple" className="space-y-4">
            {clients.map(client => (
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
            ))}
        </Accordion>
    )
}


export default function ClientsPage() {
  const { accountId, userAccount, isSuperAdmin, loading: authLoading } = useAuth();
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [activeRentals, setActiveRentals] = useState<Rental[]>([]);
  const [completedRentals, setCompletedRentals] = useState<CompletedRental[]>([]);
  const [activeOperations, setActiveOperations] = useState<PopulatedOperation[]>([]);
  const [completedOperations, setCompletedOperations] = useState<CompletedOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { db } = getFirebase();

  const canAccess = isSuperAdmin || userAccount?.permissions?.canAccessClients;

  useEffect(() => {
    if (authLoading) return;
    if (!canAccess) {
      setLoading(false);
      return;
    }

    if (accountId && db) {
        setLoading(true);
        const unsubscribeClients = getClients(accountId, setAllClients);
        const unsubscribeRentals = getRentals(accountId, setActiveRentals);
        const unsubscribeOps = getPopulatedOperations(accountId, setActiveOperations, console.error);

        Promise.all([
            getCompletedRentals(accountId),
            getCompletedOperations(accountId)
        ]).then(([completedRentalsData, completedOpsData]) => {
            setCompletedRentals(completedRentalsData);
            setCompletedOperations(completedOpsData);
        }).finally(() => {
             // We can set loading to false after all initial fetches are done.
            if(allClients.length > 0 || activeRentals.length > 0 || activeOperations.length > 0) {
                 setLoading(false);
            }
        });

      return () => {
        unsubscribeClients();
        unsubscribeRentals();
        unsubscribeOps();
      };
    } else {
      setAllClients([]);
      setActiveRentals([]);
      setCompletedRentals([]);
      setActiveOperations([]);
      setCompletedOperations([]);
      setLoading(false);
    }
  }, [accountId, authLoading, canAccess, db]);

  const { activeClients, newClients, completedClients, unservedClients } = useMemo(() => {
    const today = new Date();
    const threeDaysAgo = addDays(today, -3);

    const activeClientIds = new Set([
        ...activeRentals.map(r => r.clientId),
        ...activeOperations.map(o => o.clientId)
    ]);
    
    const completedClientIds = new Set([
        ...completedRentals.map(r => r.clientId),
        ...completedOperations.map(o => o.clientId)
    ]);
    
    const active: Client[] = [];
    const newC: Client[] = [];
    const completed: Client[] = [];
    const unserved: Client[] = [];

    allClients.forEach(client => {
      const hasActiveService = activeClientIds.has(client.id);
      const hasCompletedService = completedClientIds.has(client.id);
      const creationDate = client.createdAt ? (typeof client.createdAt === 'string' ? parseISO(client.createdAt) : client.createdAt.toDate()) : new Date(0);
      const isNew = differenceInDays(today, creationDate) <= 3;

      if (hasActiveService) {
        active.push(client);
      } else if (isNew && !hasActiveService && !hasCompletedService) {
        newC.push(client);
      } else if (!hasActiveService && hasCompletedService) {
        completed.push(client);
      } else if (!isNew && !hasActiveService && !hasCompletedService) {
        unserved.push(client);
      }
    });

    const filterFn = (client: Client) => {
        if (!searchTerm) return true;
        return client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            client.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (client.address && client.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (client.cpfCnpj && client.cpfCnpj.toLowerCase().includes(searchTerm.toLowerCase()));
    };

    return {
      activeClients: active.filter(filterFn),
      newClients: newC.filter(filterFn),
      completedClients: completed.filter(filterFn),
      unservedClients: unserved.filter(filterFn),
    };
  }, [allClients, activeRentals, completedRentals, activeOperations, completedOperations, searchTerm]);


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
            <div className="space-y-6">
                {newClients.length > 0 && (
                    <div>
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Star className="h-5 w-5" />
                            Novos Clientes ({newClients.length})
                        </h2>
                        <ClientList clients={newClients} />
                    </div>
                )}
                
                <div>
                  <h2 className="text-lg font-semibold mb-4">Em Atendimento ({activeClients.length})</h2>
                  <ClientList clients={activeClients} />
                </div>

                 {completedClients.length > 0 && (
                     <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="completed-clients" className="border rounded-lg shadow-sm bg-card">
                             <AccordionTrigger className="p-4 hover:no-underline font-medium text-base">
                                <div className="flex items-center gap-2">
                                    <CheckCircle className="h-5 w-5" />
                                    Clientes Concluídos ({completedClients.length})
                                </div>
                            </AccordionTrigger>
                             <AccordionContent>
                                <Separator />
                                <div className="p-4">
                                     <ClientList clients={completedClients} />
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                )}

                {unservedClients.length > 0 && (
                     <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="unserved-clients" className="border rounded-lg shadow-sm bg-card">
                             <AccordionTrigger className="p-4 hover:no-underline font-medium text-base">
                                <div className="flex items-center gap-2">
                                    <UserX className="h-5 w-5" />
                                    Clientes Não Atendidos ({unservedClients.length})
                                </div>
                            </AccordionTrigger>
                             <AccordionContent>
                                <Separator />
                                <div className="p-4">
                                     <ClientList clients={unservedClients} />
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                )}
            </div>
        )}
    </div>
  );
}
