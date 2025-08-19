"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PlusCircle, Truck } from "lucide-react";

const navLinks = [
  { href: "/", label: "Painel de Controle" },
  { href: "/dumpsters", label: "Caçambas" },
  { href: "/clients", label: "Clientes" },
];

export function Header() {
  const pathname = usePathname();

  const renderNavLinks = () =>
    navLinks.map((link) => (
      <Link
        key={link.href}
        href={link.href}
        className={cn(
          "text-sm font-medium transition-colors hover:text-primary",
          pathname === link.href ? "text-primary" : "text-muted-foreground"
        )}
      >
        {link.label}
      </Link>
    ));

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <div className="mr-4 flex items-center">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <Truck className="h-6 w-6 text-primary" />
            <span className="font-bold font-headline sm:inline-block">
              CaçambaControl
            </span>
          </Link>
          <nav className="hidden md:flex items-center space-x-6">{renderNavLinks()}</nav>
        </div>

        <div className="flex flex-1 items-center justify-end space-x-4">
          <Button asChild>
            <Link href="/rentals/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              Novo Aluguel
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
