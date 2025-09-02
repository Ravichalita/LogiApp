
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

export default function AccessDeniedPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-center">
      <div className="p-4 bg-destructive/10 rounded-full mb-4">
        <ShieldAlert className="h-12 w-12 text-destructive" />
      </div>
      <h1 className="text-4xl font-bold font-headline text-destructive mb-4">Acesso Negado</h1>
      <p className="text-lg text-muted-foreground mb-8 max-w-md">
        Você não tem permissão para acessar esta página. Por favor, contate o administrador da sua conta se você acredita que isso é um erro.
      </p>
      <Button asChild>
        <Link href="/">
          Voltar para a Página Inicial
        </Link>
      </Button>
    </div>
  );
}
