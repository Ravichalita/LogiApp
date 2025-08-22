
'use client';

import type { CompletedRental } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Rectangle,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useMemo } from 'react';
import { format, getMonth, getYear, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface StatsDisplayProps {
  rentals: CompletedRental[];
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function StatsDisplay({ rentals }: StatsDisplayProps) {
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const {
    rentalsThisMonth,
    revenueThisMonth,
    rentalsThisYear,
    revenueThisYear,
    monthlyChartData,
  } = useMemo(() => {
    const monthlyData = Array.from({ length: 12 }, (_, i) => ({
      name: format(new Date(currentYear, i), 'MMM', { locale: ptBR }),
      Faturamento: 0,
      Aluguéis: 0,
    }));

    let rentalsThisMonth = 0;
    let revenueThisMonth = 0;
    let rentalsThisYear = 0;
    let revenueThisYear = 0;

    for (const rental of rentals) {
      // Ensure completedDate is a Date object
      const completedDate = typeof rental.completedDate === 'string' 
        ? parseISO(rental.completedDate) 
        : rental.completedDate;
        
      const rentalYear = getYear(completedDate);
      const rentalMonth = getMonth(completedDate);

      if (rentalYear === currentYear) {
        rentalsThisYear++;
        revenueThisYear += rental.totalValue;

        if (rentalMonth === currentMonth) {
          rentalsThisMonth++;
          revenueThisMonth += rental.totalValue;
        }

        // Aggregate data for the chart
        monthlyData[rentalMonth].Faturamento += rental.totalValue;
        monthlyData[rentalMonth].Aluguéis++;
      }
    }
    
    // Capitalize month names for the chart
    const capitalizedMonthlyData = monthlyData.map(data => ({
        ...data,
        name: data.name.charAt(0).toUpperCase() + data.name.slice(1)
    }));


    return {
      rentalsThisMonth,
      revenueThisMonth,
      rentalsThisYear,
      revenueThisYear,
      monthlyChartData: capitalizedMonthlyData,
    };
  }, [rentals, currentMonth, currentYear]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Faturamento (Mês)</CardTitle>
            <CardDescription className="text-2xl font-bold">{formatCurrency(revenueThisMonth)}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Aluguéis Finalizados (Mês)</CardTitle>
            <CardDescription className="text-2xl font-bold">{rentalsThisMonth}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Faturamento (Ano)</CardTitle>
            <CardDescription className="text-2xl font-bold">{formatCurrency(revenueThisYear)}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Aluguéis Finalizados (Ano)</CardTitle>
            <CardDescription className="text-2xl font-bold">{rentalsThisYear}</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Visão Geral Mensal ({currentYear})</CardTitle>
          <CardDescription>Faturamento e quantidade de aluguéis finalizados por mês.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={monthlyChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis
                yAxisId="left"
                stroke="#888888"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `R$${value}`}
              />
               <YAxis yAxisId="right" orientation="right" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 'var(--radius)',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value, name) => {
                    if (name === 'Faturamento') return formatCurrency(value as number);
                    return value;
                }}
              />
              <Legend iconSize={12} />
              <Bar yAxisId="left" dataKey="Faturamento" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} activeBar={<Rectangle fill="hsla(var(--primary), 0.8)" />} />
              <Bar yAxisId="right" dataKey="Aluguéis" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} activeBar={<Rectangle fill="hsla(var(--accent), 0.8)" />} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
