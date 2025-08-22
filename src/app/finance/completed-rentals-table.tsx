
'use client';
import type { PopulatedCompletedRental } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CompletedRentalsTableProps {
    rentals: PopulatedCompletedRental[];
}

function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
}

export function CompletedRentalsTable({ rentals }: CompletedRentalsTableProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Histórico de Aluguéis Finalizados</CardTitle>
                <CardDescription>
                    Todos os seus aluguéis concluídos estão listados abaixo.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Finalizado em</TableHead>
                                <TableHead>Caçamba</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead className="text-center">Dias</TableHead>
                                <TableHead className="text-right">Valor Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rentals.map((rental) => (
                                <TableRow key={rental.id}>
                                    <TableCell>{format(rental.completedDate, "dd/MM/yyyy")}</TableCell>
                                    <TableCell className="font-medium">{rental.dumpster?.name ?? 'N/A'}</TableCell>
                                    <TableCell>{rental.client?.name ?? 'N/A'}</TableCell>
                                    <TableCell className="text-center">{rental.rentalDays}</TableCell>
                                    <TableCell className="text-right font-semibold">{formatCurrency(rental.totalValue)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
