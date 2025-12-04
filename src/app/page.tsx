
'use client';

import Image from "next/image";
import Link from "next/link";
import { HeaderLogin } from "@/components/home/header-login";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Truck, Calendar, PieChart, ShieldCheck } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex flex-col md:flex-row h-auto md:h-16 items-center justify-between py-2 md:py-0">
          <div className="flex items-center space-x-2 mb-2 md:mb-0">
             <Image
                src="/192x192.png"
                alt="LogiApp Logo"
                width={32}
                height={32}
             />
             <span className="font-bold text-xl text-primary">LogiApp</span>
          </div>
          <HeaderLogin />
        </div>
      </header>

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="honeycomb-bg relative py-20 lg:py-32 overflow-hidden">
             <div className="container px-4 md:px-6 relative z-10">
                <div className="flex flex-col items-center space-y-4 text-center">
                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none text-foreground">
                            Gestão Completa para Empresas de <br className="hidden md:inline" />
                            <span className="text-primary">Limpa Fossa</span> e <span className="text-primary">Locação de Caçambas</span>
                        </h1>
                        <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl">
                             Elimine planilhas e otimize sua logística. Do agendamento do caminhão vácuo à retirada da caçamba, controle tudo em um só lugar.
                        </p>
                    </div>
                </div>
            </div>
        </section>

        {/* Benefits Section */}
        <section className="py-16 md:py-24 bg-muted/50">
            <div className="container px-4 md:px-6">
                 <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="flex flex-col items-center space-y-4 text-center">
                        <div className="p-4 bg-primary/10 rounded-full">
                             <Truck className="h-10 w-10 text-primary" />
                        </div>
                        <h3 className="text-xl font-bold">Logística Inteligente</h3>
                        <p className="text-muted-foreground">
                            Roteirização automática para motoristas e acompanhamento de status em tempo real. Saiba onde sua frota está.
                        </p>
                    </div>
                    <div className="flex flex-col items-center space-y-4 text-center">
                        <div className="p-4 bg-primary/10 rounded-full">
                             <Calendar className="h-10 w-10 text-primary" />
                        </div>
                        <h3 className="text-xl font-bold">Gestão Financeira</h3>
                        <p className="text-muted-foreground">
                            Faturamento automático de locações recorrentes e serviços avulsos. Chega de perder cobranças por esquecimento.
                        </p>
                    </div>
                    <div className="flex flex-col items-center space-y-4 text-center">
                         <div className="p-4 bg-primary/10 rounded-full">
                             <PieChart className="h-10 w-10 text-primary" />
                        </div>
                        <h3 className="text-xl font-bold">Controle de Ativos</h3>
                        <p className="text-muted-foreground">
                            Rastreamento total de caçambas e histórico de manutenção de caminhões. Gestão proativa da sua frota.
                        </p>
                    </div>
                 </div>
            </div>
        </section>

        {/* Transparency / LGPD Section */}
        <section className="py-16 md:py-24">
             <div className="container px-4 md:px-6">
                <div className="flex flex-col md:flex-row items-center gap-12">
                    <div className="flex-1 space-y-4">
                        <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl">Transparência e Segurança</h2>
                        <p className="text-muted-foreground text-lg">
                            O LogiApp leva a sério a sua privacidade e a segurança dos dados da sua empresa.
                        </p>
                        <ul className="space-y-2">
                             <li className="flex items-center">
                                <ShieldCheck className="mr-2 h-5 w-5 text-primary" />
                                <span>Dados utilizados estritamente para gestão operacional e fiscal.</span>
                            </li>
                             <li className="flex items-center">
                                <ShieldCheck className="mr-2 h-5 w-5 text-primary" />
                                <span>Infraestrutura segura em nuvem.</span>
                            </li>
                            <li className="flex items-center">
                                <ShieldCheck className="mr-2 h-5 w-5 text-primary" />
                                <span>Conformidade com a LGPD.</span>
                            </li>
                        </ul>
                    </div>
                     <div className="flex-1">
                        <div className="bg-card border rounded-lg p-6 shadow-sm">
                            <h4 className="font-semibold mb-2">Por que pedimos seus dados?</h4>
                            <p className="text-sm text-muted-foreground mb-4">
                                Para garantir que apenas pessoas autorizadas acessem as informações da sua frota e para permitir a emissão correta de ordens de serviço e faturas.
                            </p>
                             <Link href="/privacy-policy" className="text-primary hover:underline text-sm font-medium">
                                Leia nossa Política de Privacidade Completa &rarr;
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </section>
      </main>

      <footer className="py-6 md:px-8 md:py-0 bg-muted/30 border-t">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            &copy; {new Date().getFullYear()} LogiApp. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground">
             <Link href="/privacy-policy" className="hover:text-foreground hover:underline">
                Política de Privacidade
             </Link>
             <Link href="mailto:ravichalita@gmail.com" className="hover:text-foreground hover:underline">
                Contato
             </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
