
import { getClients } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ClientForm } from './client-form';
import { ClientActions } from './client-actions';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Mail, FileText, MapPin, Phone } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';

export default async function ClientsPage() {
  const clients = await getClients();

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <h1 className="text-3xl font-headline font-bold mb-6">Gerenciar Clientes</h1>
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Meus Clientes</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="space-y-4">
                {clients.length > 0 ? clients.map(client => (
                  <AccordionItem value={client.id} key={client.id} className="border rounded-lg shadow-sm">
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{client.name}</div>
                        <ClientActions client={client} />
                      </div>
                      <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                         <Phone className="h-4 w-4 shrink-0"/> <span>{client.phone}</span>
                      </div>
                      <AccordionTrigger className="text-sm text-primary hover:no-underline p-0 pt-2 justify-start [&>svg]:ml-1">
                        Ver Detalhes
                      </AccordionTrigger>
                    </div>
                    <AccordionContent>
                      <Separator />
                      <div className="space-y-4 p-4 bg-muted/50">
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
                        {!client.email && !client.observations && (
                            <p className="text-sm text-muted-foreground text-center py-2">Nenhuma informação adicional cadastrada.</p>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )) : (
                  <p className="text-center text-muted-foreground py-8">Nenhum cliente cadastrado ainda.</p>
                )}
              </Accordion>
            </CardContent>
          </Card>
        </div>
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Novo Cliente</CardTitle>
              <CardDescription>Adicione um novo cliente à sua lista de contatos.</CardDescription>
            </CardHeader>
            <CardContent>
              <ClientForm />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
