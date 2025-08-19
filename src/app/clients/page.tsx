
import { getClients } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ClientForm } from './client-form';
import { ClientActions } from './client-actions';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Mail, FileText, ChevronDown } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import React from 'react';

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
              <div className="border rounded-md">
                <Accordion type="single" collapsible className="w-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead className='hidden md:table-cell'>Telefone</TableHead>
                        <TableHead className='hidden lg:table-cell'>Endereço</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clients.map(client => (
                        <AccordionItem value={client.id} key={client.id} asChild>
                           <React.Fragment>
                             <TableRow>
                                <TableCell>
                                   <AccordionTrigger className='p-2 -m-2 hover:no-underline [&[data-state=open]>svg]:rotate-180'>
                                      <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                                   </AccordionTrigger>
                                </TableCell>
                                <TableCell className="font-medium">{client.name}</TableCell>
                                <TableCell className='hidden md:table-cell'>{client.phone}</TableCell>
                                <TableCell className='hidden lg:table-cell truncate max-w-xs'>{client.address}</TableCell>
                                <TableCell className="text-right">
                                  <ClientActions client={client} />
                                </TableCell>
                              </TableRow>
                              <AccordionContent asChild>
                                <tr className='bg-muted/50 hover:bg-muted/50'>
                                  <td colSpan={5} className="p-4 pt-0">
                                    <div className="space-y-4 p-4 bg-background/50 rounded-md">
                                      <p className='lg:hidden'><span className='font-semibold'>Endereço:</span> {client.address}</p>
                                      <p className='md:hidden'><span className='font-semibold'>Telefone:</span> {client.phone}</p>
                                      <Separator className='md:hidden'/>
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
                                  </td>
                                </tr>
                              </AccordionContent>
                           </React.Fragment>
                        </AccordionItem>
                      ))}
                    </TableBody>
                  </Table>
                </Accordion>
              </div>
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
