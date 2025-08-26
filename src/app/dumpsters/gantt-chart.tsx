
'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { startOfToday, endOfToday, addDays, differenceInDays, format, isAfter, isBefore, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Dumpster, Rental } from '@/lib/types';

interface GanttChartProps {
    dumpsters: Dumpster[];
    rentals: Rental[];
}

interface ChartDataItem {
    name: string;
    [key: string]: any;
}

const statusColors = {
    Alugada: 'hsl(var(--destructive))',
    Reservada: 'hsl(var(--warning))',
    Manutenção: 'hsl(var(--muted-foreground))',
    Disponível: 'hsl(var(--primary-foreground))',
};

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        const barData = payload.find(p => p.value > 0)?.payload;
        
        if (!barData?.rentalInfo) {
            return (
                <div className="bg-background border border-border shadow-lg rounded-md p-3 text-sm">
                    <p className="font-bold">{label}</p>
                    <p>Status: Disponível</p>
                </div>
            );
        }
        
        const { client, rentalDate, returnDate, status } = barData.rentalInfo;

        return (
            <div className="bg-background border border-border shadow-lg rounded-md p-3 text-sm">
                <p className="font-bold">{label}</p>
                <p className="capitalize">Status: {status}</p>
                <p>Cliente: {client}</p>
                <p>Período: {format(parseISO(rentalDate), 'dd/MM')} - {format(parseISO(returnDate), 'dd/MM')}</p>
            </div>
        );
    }
    return null;
};


export function GanttChart({ dumpsters, rentals }: GanttChartProps) {
    const { chartData, dateTicks } = useMemo(() => {
        const today = startOfToday();
        const endDate = addDays(today, 30);
        const totalDays = differenceInDays(endDate, today) + 1;

        const dateTicks = Array.from({ length: 7 }, (_, i) => {
            const date = addDays(today, i * 5);
            return {
                date: format(date, 'dd/MM'),
                dayIndex: differenceInDays(date, today),
            };
        });

        const data: ChartDataItem[] = dumpsters
        .filter(d => d.status !== 'Em Manutenção')
        .sort((a,b) => a.name.localeCompare(b.name))
        .map(dumpster => {
            let currentDay = 0;
            const dumpsterData: ChartDataItem = { name: dumpster.name };

            const dumpsterRentals = rentals
                .filter(r => r.dumpsterId === dumpster.id && isBefore(parseISO(r.rentalDate), endDate))
                .sort((a, b) => parseISO(a.rentalDate).getTime() - parseISO(b.rentalDate).getTime());

            dumpsterRentals.forEach(rental => {
                const rentalStart = parseISO(rental.rentalDate);
                const rentalEnd = parseISO(rental.returnDate);

                const startDay = Math.max(0, differenceInDays(rentalStart, today));
                const endDay = Math.min(totalDays - 1, differenceInDays(rentalEnd, today));
                
                if(startDay >= totalDays) return;

                // Segmento Disponível antes do aluguel
                if (startDay > currentDay) {
                    dumpsterData[`Disponível-${currentDay}`] = startDay - currentDay;
                }

                // Segmento Alugado/Reservado
                const duration = Math.max(1, endDay - startDay + 1);
                const status = isAfter(rentalStart, today) ? 'Reservada' : 'Alugada';
                
                dumpsterData[`${status}-${startDay}`] = {
                    days: duration,
                    rentalInfo: {
                        client: 'Carregando...', // Will be populated later
                        rentalDate: rental.rentalDate,
                        returnDate: rental.returnDate,
                        status: status,
                        clientId: rental.clientId,
                    }
                };
                currentDay = endDay + 1;
            });

            // Segmento Disponível final
            if (currentDay < totalDays) {
                dumpsterData[`Disponível-${currentDay}`] = totalDays - currentDay;
            }
            
            return dumpsterData;
        });

        // This part could be improved by fetching all clients once
        // For now, it's illustrative and might be slow with many rentals
        data.forEach(d => {
            Object.keys(d).forEach(key => {
                if(d[key]?.rentalInfo?.clientId) {
                    // In a real app, you would fetch the client name here
                    // This is a simplification
                    d[key].rentalInfo.client = `Cliente ${d[key].rentalInfo.clientId.substring(0,4)}`;
                }
            })
        })

        return { chartData: data, dateTicks };

    }, [dumpsters, rentals]);

    if (dumpsters.length === 0) {
        return <div className="flex items-center justify-center h-[400px] text-muted-foreground">Nenhuma caçamba para exibir no gráfico.</div>;
    }

    return (
        <div style={{ width: '100%', height: 40 + dumpsters.length * 40 }}>
            <ResponsiveContainer>
                <BarChart
                    layout="vertical"
                    data={chartData}
                    margin={{ top: 5, right: 20, left: 20, bottom: 20 }}
                >
                    <CartesianGrid stroke="hsl(var(--border))" horizontal={true} vertical={true} />
                    <XAxis 
                        type="number" 
                        domain={[0, 30]} 
                        ticks={dateTicks.map(t => t.dayIndex)}
                        tickFormatter={(tick) => dateTicks.find(t=> t.dayIndex === tick)?.date || ''}
                    />
                    <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    
                    {Object.keys(statusColors).map((status, i) => (
                        chartData.flatMap(d => Object.keys(d).filter(key => key.startsWith(status))).map(key => (
                            <Bar 
                                key={key} 
                                dataKey={(item) => item[key]?.days || item[key]} 
                                stackId="a" 
                                fill={statusColors[status as keyof typeof statusColors]} 
                                name={key}
                                radius={0}
                            />
                        ))
                    ))}
                    
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
