

'use client';

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ChartData {
    name: string;
    value: number;
}

interface RevenueByClientChartProps {
    data: ChartData[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF1919'];

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border border-border shadow-lg rounded-md p-2">
        <p className="font-bold">{`${payload[0].name}`}</p>
        <p className="text-primary">{`Faturamento: ${formatCurrency(payload[0].value)}`}</p>
      </div>
    );
  }

  return null;
};

export function RevenueByClientChart({ data }: RevenueByClientChartProps) {
    if (!data || data.length === 0) {
        return <div className="flex items-center justify-center h-[300px] text-muted-foreground">Nenhum dado para exibir.</div>;
    }
    
    return (
        <ResponsiveContainer width="100%" height={300}>
            <PieChart>
                <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                >
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                    verticalAlign="bottom"
                    formatter={(value, entry, index) => <span className="text-muted-foreground">{value}</span>}
                    wrapperStyle={{ paddingTop: '20px' }}
                />
            </PieChart>
        </ResponsiveContainer>
    );
}
