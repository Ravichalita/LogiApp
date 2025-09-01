
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Truck as TruckIcon } from 'lucide-react';

export interface Truck {
  id: string;
  model: string;
  licensePlate: string;
  year: number;
  capacity: string;
  type: string;
}

interface TruckCardProps {
  truck: Truck;
}

export function TruckCard({ truck }: TruckCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{truck.model}</CardTitle>
        <TruckIcon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-lg font-bold">{truck.licensePlate}</div>
        <p className="text-xs text-muted-foreground">
          Ano: {truck.year}
        </p>
      </CardContent>
    </Card>
  );
}
