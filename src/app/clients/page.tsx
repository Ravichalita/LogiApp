import { getClients } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ClientForm } from './client-form';

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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Endereço</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.map(client => (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">{client.name}</TableCell>
                        <TableCell>{client.phone}</TableCell>
                        <TableCell>{client.address}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
