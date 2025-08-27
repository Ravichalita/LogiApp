
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ClientForm } from '../client-form';


export default function NewClientPage() {

  return (
    <div className="container mx-auto max-w-2xl py-8 px-4 md:px-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-2xl">Novo Cliente</CardTitle>
          <CardDescription>Adicione um novo cliente à sua lista.</CardDescription>
        </CardHeader>
        <CardContent>
            <ClientForm />
        </CardContent>
      </Card>
    </div>
  );
}
