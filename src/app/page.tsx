
'use client';

import Image from "next/image";
import Link from "next/link";
import { HeaderLogin } from "@/components/home/header-login";
import { FeatureCard } from "@/components/home/feature-card";
import { Truck, Calendar, PieChart, ShieldCheck, ChevronDown } from "lucide-react";
import { HoneycombAnimation } from "@/components/home/honeycomb-animation";

export default function HomePage() {
    return (
        <div className="flex flex-col min-h-screen">
            {/* Header */}
            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container flex flex-row items-center justify-between h-16 py-0">
                    <div className="flex items-center space-x-2">
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
                <section className="relative min-h-[calc(100vh-4rem)] lg:min-h-0 lg:py-32 overflow-hidden flex flex-col justify-center">
                    <HoneycombAnimation />
                    <div className="container px-4 md:px-6 relative z-10 flex-grow flex flex-col justify-center">
                        <div className="flex flex-col items-center space-y-4 text-center">
                            <div className="space-y-4">
                                <h1 className="text-2xl font-bold tracking-tighter sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl/none text-foreground dark:[text-shadow:_0_2px_8px_rgba(0,0,0,0.9)]">
                                    Gestão Completa para Empresas de <br className="hidden sm:inline" />
                                    <span className="text-primary drop-shadow-sm">Limpa Fossa</span> e <br className="sm:hidden" /><span className="text-primary drop-shadow-sm">Locação de Caçambas</span>
                                </h1>
                                <p className="mx-auto max-w-[700px] text-sm sm:text-base md:text-lg lg:text-xl text-foreground/80 dark:text-muted-foreground dark:[text-shadow:_0_1px_4px_rgba(0,0,0,0.6)] px-2">
                                    Elimine planilhas e otimize sua logística. Do agendamento do caminhão vácuo à retirada da caçamba, controle tudo em um só lugar.
                                </p>
                            </div>
                        </div>
                    </div>
                    {/* Scroll Indicator - Mobile Only */}
                    <div className="lg:hidden absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-bounce">
                        <ChevronDown className="h-8 w-8 text-primary/70" />
                    </div>
                </section>

                {/* Benefits Section */}
                <section className="py-16 md:py-24 bg-muted/50">
                    <div className="container px-4 md:px-6">
                        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-3 items-start">
                            <FeatureCard
                                title="Logística Inteligente"
                                icon={<Truck className="h-10 w-10 text-primary" />}
                                summary="Roteirização automática para motoristas e acompanhamento de status em tempo real. Saiba onde sua frota está."
                                description="Maximize a eficiência da sua frota com nosso sistema de roteirização inteligente. O LogiApp utiliza Inteligência Artificial para calcular as melhores rotas, economizando combustível e tempo. Visualize o trajeto no mapa, receba previsões de trânsito em tempo real e distribua tarefas automaticamente entre seus motoristas. Acompanhe cada etapa, desde a saída da base até a conclusão do serviço, garantindo pontualidade e redução de custos operacionais."
                            />

                            <FeatureCard
                                title="Gestão Financeira"
                                icon={<Calendar className="h-10 w-10 text-primary" />}
                                summary="Faturamento automático de locações recorrentes e serviços avulsos. Chega de perder cobranças por esquecimento."
                                description="Tenha controle total sobre o fluxo de caixa da sua empresa. O módulo financeiro permite gerenciar receitas e despesas, categorizar transações e visualizar relatórios detalhados de lucro e faturamento. Automatize cobranças com suporte a faturamento recorrente (mensal, semanal ou quinzenal) e mantenha um histórico completo de todas as ordens de serviço e locações finalizadas. Tome decisões baseadas em dados concretos."
                            />

                            <FeatureCard
                                title="Controle de Ativos"
                                icon={<PieChart className="h-10 w-10 text-primary" />}
                                summary="Rastreamento total de caçambas e histórico de manutenção de caminhões. Gestão proativa da sua frota."
                                description="Monitore todos os seus bens em um só lugar. Gerencie o ciclo de vida completo das suas caçambas, sabendo exatamente onde cada uma está, seu status (alugada, disponível, em manutenção) e histórico de locações. Controle sua frota de caminhões, agende manutenções e vincule veículos a motoristas e rotas. Evite perdas e maximize a utilização dos seus equipamentos com nosso inventário digital detalhado."
                            />
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
