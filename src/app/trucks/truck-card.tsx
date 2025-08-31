
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
  type: 'Caminhão a vácuo' | 'Hidro-Vácuo combinado';
}

interface TruckCardProps {
  truck: Truck;
  onEdit: () => void;
  onDelete: () => void;
}

export function TruckCard({ truck, onEdit, onDelete }: TruckCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{truck.model}</CardTitle>
        <TruckIcon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-lg font-bold">{truck.licensePlate}</div>
        <p className="text-xs text-muted-foreground">
          Ano: {truck.year} - {truck.type}
        </p>
        <p className="text-xs text-muted-foreground">
          Capacidade: {truck.capacity}
        </p>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={onEdit}>
            Editar
          </Button>
          <Button variant="destructive" size="sm" onClick={onDelete}>
            Excluir
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
