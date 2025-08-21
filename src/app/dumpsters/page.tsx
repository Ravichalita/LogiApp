
'use client';

import { useEffect, useState, useMemo } from 'react';
import { getDumpsters, getPendingRentals } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DumpsterActions } from './dumpster-actions';
import { Separator } from '@/components/ui/separator';
import type { Dumpster, Rental, EnhancedDumpster } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { startOfToday, format, isAfter } from 'date-fns';


function DumpsterTableSkeleton() {
    return (
         <div className="border rounded-md">
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
                    {[...Array(3)].map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-10" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

export default function DumpstersPage() {
  const { user } = useAuth();
  const [dumpsters, setDumpsters] = useState<Dumpster[]>([]);
  const [pendingRentals, setPendingRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (user) {
      const unsubscribeDumpsters = getDumpsters(user.uid, (data) => {
        setDumpsters(data);
        if(loading) setLoading(false);
      });
      const unsubscribeRentals = getPendingRentals(user.uid, (data) => {
        setPendingRentals(data);
      });
      
      return () => {
        unsubscribeDumpsters();
        unsubscribeRentals();
      }
    } else {
        setDumpsters([]);
        setPendingRentals([]);
        setLoading(false);
    }
  }, [user, loading]);

  const dumpstersWithDerivedStatus = useMemo((): EnhancedDumpster[] => {
    const today = startOfToday();
    const scheduledRentalsMap = new Map<string, Rental>();
    
    // Get the earliest future rental for each dumpster
    pendingRentals
      .filter(r => isAfter(new Date(r.rentalDate), today))
      .sort((a,b) => new Date(a.rentalDate).getTime() - new Date(b.rentalDate).getTime())
      .forEach(r => {
        if (!scheduledRentalsMap.has(r.dumpsterId)) {
          scheduledRentalsMap.set(r.dumpsterId, r);
        }
      });

    return dumpsters.map(d => {
      if (d.status === 'Disponível' && scheduledRentalsMap.has(d.id)) {
        const rental = scheduledRentalsMap.get(d.id)!;
        const formattedDate = format(new Date(rental.rentalDate), "dd/MM/yy");
        return { 
          ...d, 
          status: `Reservada para ${formattedDate}`,
          originalStatus: 'Disponível'
        };
      }
      return d;
    })

  }, [dumpsters, pendingRentals]);


  const filteredDumpsters = useMemo(() => {
    if (!searchTerm) {
      return dumpstersWithDerivedStatus;
    }
    return dumpstersWithDerivedStatus.filter(d =>
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.color.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(d.size).includes(searchTerm)
    );
  }, [dumpstersWithDerivedStatus, searchTerm]);


  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <h1 className="text-3xl font-headline font-bold mb-6">Gerenciar Caçambas</h1>
        <Card>
            <CardHeader>
            <CardTitle>Minhas Caçambas</CardTitle>
                <div className="relative mt-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por nome, cor, tamanho..."
                        className="pl-9"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </CardHeader>
            <CardContent>
                {loading ? <DumpsterTableSkeleton /> : (
                    <>
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
                            {filteredDumpsters.length > 0 ? filteredDumpsters.map(dumpster => (
                                <TableRow key={dumpster.id}>
                                <TableCell className="font-medium">{dumpster.name}</TableCell>
                                <TableCell>{dumpster.color}</TableCell>
                                <TableCell>{dumpster.size}</TableCell>
                                <TableCell className="text-right">
                                    <DumpsterActions dumpster={dumpster} />
                                </TableCell>
                                </TableRow>
                            )) : (
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
                        {filteredDumpsters.length > 0 ? filteredDumpsters.map(dumpster => (
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
                        )) : (
                            <div className="text-center py-10">
                            <p>Nenhuma caçamba cadastrada.</p>
                            </div>
                        )}
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    </div>
  );
}
