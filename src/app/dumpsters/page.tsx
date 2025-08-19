import { getDumpsters } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DumpsterForm } from './dumpster-form';
import { DumpsterActions } from './dumpster-actions';
import { Separator } from '@/components/ui/separator';

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
              {/* Table for larger screens */}
              <div className="hidden md:block border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Identificador</TableHead>
                      <TableHead>Cor</TableHead>
                      <TableHead>Tamanho (m³)</TableHead>
                      <TableHead className="text-right">Status / Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dumpsters.map(dumpster => (
                      <TableRow key={dumpster.id}>
                        <TableCell className="font-medium">{dumpster.name}</TableCell>
                        <TableCell>{dumpster.color}</TableCell>
                        <TableCell>{dumpster.size}</TableCell>
                        <TableCell className="text-right">
                          <DumpsterActions dumpster={dumpster} />
                        </TableCell>
                      </TableRow>
                    ))}
                     {dumpsters.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">
                          Nenhuma caçamba cadastrada.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              
              {/* Cards for smaller screens */}
              <div className="md:hidden space-y-4">
                {dumpsters.map(dumpster => (
                  <div key={dumpster.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                        <h3 className="font-bold text-lg">{dumpster.name}</h3>
                        <div className="w-auto">
                            <DumpsterActions dumpster={dumpster} />
                        </div>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Cor: <span className="font-medium text-foreground">{dumpster.color}</span></span>
                      <span>Tamanho: <span className="font-medium text-foreground">{dumpster.size} m³</span></span>
                    </div>
                  </div>
                ))}
                {dumpsters.length === 0 && (
                  <div className="text-center py-10">
                    <p>Nenhuma caçamba cadastrada.</p>
                  </div>
                )}
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
