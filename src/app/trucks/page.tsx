
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { TruckCard, Truck } from './truck-card';
import { TruckForm } from './truck-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { NewItemDialog } from '@/components/new-item-dialog';

const initialTrucks: Truck[] = [
  {
    id: '1',
    model: 'Scania R450',
    licensePlate: 'BRA2E19',
    year: 2023,
    capacity: '25 toneladas',
  },
  {
    id: '2',
    model: 'Volvo FH 540',
    licensePlate: 'PRL1A23',
    year: 2022,
    capacity: '27 toneladas',
  },
];

export default function TrucksPage() {
  const [trucks, setTrucks] = useState<Truck[]>(initialTrucks);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedTruck, setSelectedTruck] = useState<Truck | null>(null);

  const handleEditTruck = (truck: Truck) => {
    setSelectedTruck(truck);
    setIsFormOpen(true);
  };

  const handleDeleteTruck = (truckId: string) => {
    setTrucks(trucks.filter(truck => truck.id !== truckId));
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    // Here you would typically refetch the trucks from the API
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Caminhões</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {trucks.map(truck => (
          <TruckCard
            key={truck.id}
            truck={truck}
            onEdit={() => handleEditTruck(truck)}
            onDelete={() => handleDeleteTruck(truck.id)}
          />
        ))}
      </div>

       <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50">
           <NewItemDialog itemType="truck" />
       </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedTruck ? 'Editar Caminhão' : 'Adicionar Caminhão'}</DialogTitle>
          </DialogHeader>
          <div className="p-6">
            <TruckForm
                onSuccess={handleFormSuccess}
                onCancel={() => setIsFormOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
