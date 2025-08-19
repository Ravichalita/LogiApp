import { getDumpsters } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DumpsterForm } from './dumpster-form';
import { DumpsterActions } from './dumpster-actions';

export default async function DumpstersPage() {
  const dumpsters = await getDumpsters();

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <h1 className="text-3xl font-headline font-bold mb-6">Gerenciar Caçambas</h1>
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Minhas Caçambas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Identificador</TableHead>
                      <TableHead className="text-right">Status / Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dumpsters.map(dumpster => (
                      <TableRow key={dumpster.id}>
                        <TableCell className="font-medium">{dumpster.name}</TableCell>
                        <TableCell className="text-right">
                          <DumpsterActions dumpster={dumpster} />
                        </TableCell>
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
              <CardTitle>Nova Caçamba</CardTitle>
              <CardDescription>Cadastre uma nova caçamba no seu inventário.</CardDescription>
            </CardHeader>
            <CardContent>
              <DumpsterForm />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}