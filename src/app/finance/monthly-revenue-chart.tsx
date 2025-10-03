'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useState } from 'react';

interface ChartData {
    name: string;
    total: number;
}

interface MonthlyRevenueChartProps {
    data: ChartData[];
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border border-border shadow-lg rounded-md p-2">
        <p className="font-bold">{`Mês: ${label}`}</p>
        <p className="text-primary">{`Faturamento: ${formatCurrency(payload[0].value)}`}</p>
      </div>
    );
  }
  return null;
};


export function MonthlyRevenueChart({ data }: MonthlyRevenueChartProps) {
    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    if (!data || data.length === 0) {
        return <div className="flex items-center justify-center h-[300px] text-muted-foreground">Nenhum dado para exibir.</div>;
    }
    
    return (
        <ResponsiveContainer width="100%" height={350}>
            <BarChart 
                data={data}
                onClick={(e) => {
                    if (e && e.activeTooltipIndex !== undefined) {
                        setActiveIndex(e.activeTooltipIndex);
                    } else {
                        setActiveIndex(null); // Hide tooltip when clicking outside bars
                    }
                }}
            >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false}/>
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value/1000}k`}/>
                <Tooltip 
                    content={<CustomTooltip />} 
                    wrapperStyle={{ outline: 'none' }}
                    // Control visibility with state
                    active={activeIndex !== null}
                    // This ensures the tooltip shows data for the active bar
                    payload={activeIndex !== null && data[activeIndex] ? [{ name: 'total', value: data[activeIndex].total, payload: data[activeIndex] }] : []}
                    label={activeIndex !== null && data[activeIndex] ? data[activeIndex].name : ''}
                />
                <Bar 
                    dataKey="total" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]} 
                />
            </BarChart>
        </ResponsiveContainer>
    );
}
