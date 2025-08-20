import { getClients, getDumpsters } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RentalForm } from './rental-form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Truck } from 'lucide-react';
import Link from 'next/link';

export default async function NewRentalPage() {
  const [dumpsters, clients] = await Promise.all([
    getDumpsters(),
    getClients(),
  ]);

  const availableDumpsters = dumpsters.filter(d => d.status === 'Disponível');

  return (
    <div className="container mx-auto max-w-2xl py-8">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-2xl">Lançar Novo Aluguel</CardTitle>
          <CardDescription>Selecione a caçamba, o cliente e as datas para registrar um novo aluguel.</CardDescription>
        </CardHeader>
        <CardContent>
          {availableDumpsters.length > 0 && clients.length > 0 ? (
             <RentalForm dumpsters={availableDumpsters} clients={clients} />
          ) : (
            <Alert>
              <Truck className="h-4 w-4" />
              <AlertTitle>Faltam informações para criar um aluguel!</AlertTitle>
              <AlertDescription>
                {availableDumpsters.length === 0 && <p>Não há caçambas disponíveis. <Link href="/dumpsters" className="font-bold underline">Cadastre uma nova caçamba</Link>.</p>}
                {clients.length === 0 && <p>Não há clientes cadastrados. <Link href="/clients" className="font-bold underline">Cadastre um novo cliente</Link>.</p>}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
