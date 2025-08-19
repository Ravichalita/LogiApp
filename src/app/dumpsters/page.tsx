import { getDumpsters } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { DumpsterForm } from './dumpster-form';
import type { DumpsterStatus } from '@/lib/types';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { EditDumpsterForm } from './edit-dumpster-form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default async function DumpstersPage() {
  const dumpsters = await getDumpsters();

  const getStatusVariant = (status: DumpsterStatus): 'default' | 'destructive' | 'secondary' => {
    switch (status) {
      case 'Disponível':
        return 'default';
      case 'Alugada':
        return 'destructive';
      case 'Em Manutenção':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

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
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dumpsters.map(dumpster => (
                      <TableRow key={dumpster.id}>
                        <TableCell className="font-medium">{dumpster.name}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(dumpster.status)} className={cn('capitalize')}>
                            {dumpster.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Dialog>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Abrir menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DialogTrigger asChild>
                                  <DropdownMenuItem>Editar</DropdownMenuItem>
                                </DialogTrigger>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Editar Caçamba</DialogTitle>
                              </DialogHeader>
                              <EditDumpsterForm dumpster={dumpster} />
                            </DialogContent>
                          </Dialog>
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