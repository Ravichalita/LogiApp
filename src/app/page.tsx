import { getClients, getDumpsters, getRentals } from '@/lib/data';
import type { PopulatedRental } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Truck, User, MapPin, Calendar, CheckCircle, Mail, Phone, Home, FileText } from 'lucide-react';
import { finishRental } from '@/lib/actions';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Separator } from '@/components/ui/separator';

async function getPopulatedRentals(): Promise<PopulatedRental[]> {
  const [rentals, dumpsters, clients] = await Promise.all([
    getRentals(),
    getDumpsters(),
    getClients(),
  ]);

  const activeRentals = rentals.filter(r => r.status === 'Ativo');

  return activeRentals.map(rental => {
    const dumpster = dumpsters.find(d => d.id === rental.dumpsterId)!;
    const client = clients.find(c => c.id === rental.clientId)!;
    return { ...rental, dumpster, client };
  }).sort((a, b) => a.returnDate.getTime() - b.returnDate.getTime());
}

export default async function DashboardPage() {
  const rentals = await getPopulatedRentals();

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-headline font-bold">Painel de Controle</h1>
      </div>

      {rentals.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-lg border">
          <Truck className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold font-headline">Nenhuma caçamba alugada no momento</h2>
          <p className="mt-2 text-muted-foreground">Clique em "Novo Aluguel" no cabeçalho para começar.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {rentals.map(rental => (
            <Accordion key={rental.id} type="single" collapsible>
               <Card className="flex flex-col shadow-md hover:shadow-lg transition-shadow duration-300">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-headline">
                      <Truck className="h-6 w-6 text-primary" />
                      {rental.dumpster.name}
                    </span>
                    <Badge variant="secondary">Ativo</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-grow space-y-4">
                  <div className="flex items-start gap-3">
                    <User className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-sm text-muted-foreground">Cliente</span>
                      <span className="font-medium">{rental.client.name}</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                     <div className="flex flex-col">
                      <span className="text-sm text-muted-foreground">Local</span>
                      <span>{rental.deliveryAddress}</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                     <div className="flex flex-col">
                      <span className="text-sm text-muted-foreground">Retirada</span>
                      <span className='font-semibold'>{new Date(rental.returnDate).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                </CardContent>
                <div className="p-6 pt-0">
                  <AccordionItem value="item-1" className="border-b-0">
                     <AccordionTrigger>Detalhes do Cliente</AccordionTrigger>
                      <AccordionContent className="space-y-4 pt-4">
                        <Separator />
                        <div className="flex items-start gap-3">
                          <Phone className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                           <div className="flex flex-col">
                            <span className="text-sm text-muted-foreground">Telefone</span>
                            <span className="font-medium">{rental.client.phone}</span>
                           </div>
                        </div>
                        {rental.client.email && (
                          <div className="flex items-start gap-3">
                            <Mail className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                            <div className="flex flex-col">
                              <span className="text-sm text-muted-foreground">Email</span>
                              <span className="font-medium">{rental.client.email}</span>
                            </div>
                          </div>
                        )}
                         <div className="flex items-start gap-3">
                            <Home className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                            <div className="flex flex-col">
                              <span className="text-sm text-muted-foreground">Endereço Principal</span>
                              <span className="font-medium">{rental.client.address}</span>
                            </div>
                          </div>
                        {rental.client.observations && (
                           <div className="flex items-start gap-3">
                            <FileText className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                            <div className="flex flex-col">
                              <span className="text-sm text-muted-foreground">Observações</span>
                              <p className="font-medium whitespace-pre-wrap">{rental.client.observations}</p>
                            </div>
                          </div>
                        )}
                      </AccordionContent>
                  </AccordionItem>
                   <form action={finishRental} className="mt-4">
                    <input type="hidden" name="rentalId" value={rental.id} />
                    <input type="hidden" name="dumpsterId" value={rental.dumpsterId} />
                    <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Finalizar Aluguel
                    </Button>
                  </form>
                </div>
              </Card>
            </Accordion>
          ))}
        </div>
      )}
    </div>
  );
}
