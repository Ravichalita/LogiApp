
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import Link from 'next/link';
import { Truck, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';


export default function SignupPage() {
  
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm relative text-center">
        <CardHeader>
           <div className="mx-auto mb-4">
                <ShieldAlert className="h-10 w-10 text-primary" />
            </div>
          <CardTitle className="text-2xl font-bold">Cadastro Desativado</CardTitle>
          <CardDescription>
            Para garantir a segurança e a exclusividade do sistema, a criação de novas contas é feita apenas pelo administrador.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <p className="text-sm text-muted-foreground">
               Se você adquiriu o sistema, por favor, entre em contato com o suporte para receber seus dados de acesso.
            </p>
        </CardContent>
        <CardFooter>
            <Button asChild className="w-full">
                <Link href="/login">
                    Ir para o Login
                </Link>
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
