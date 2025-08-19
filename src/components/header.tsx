"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { Menu, Truck, PlusCircle } from "lucide-react";

const navLinks = [
  { href: "/", label: "Painel de Controle" },
  { href: "/dumpsters", label: "Caçambas" },
  { href: "/clients", label: "Clientes" },
];

export function Header() {
  const pathname = usePathname();

  const renderNavLinks = (isMobile = false) =>
    navLinks.map((link) => {
      const linkComponent = (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            "font-medium transition-colors hover:text-primary",
            pathname === link.href ? "text-primary" : "text-muted-foreground",
            isMobile ? "text-lg" : "text-sm"
          )}
        >
          {link.label}
        </Link>
      );
      return isMobile ? <SheetClose asChild key={`${link.href}-mobile`}>{linkComponent}</SheetClose> : linkComponent;
    });


  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <div className="mr-4 hidden md:flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <Truck className="h-6 w-6 text-primary" />
            <span className="hidden font-bold sm:inline-block font-headline">
              CaçambaControl
            </span>
          </Link>
          <nav className="flex items-center space-x-6">{renderNavLinks()}</nav>
        </div>
        
        <div className="flex items-center md:hidden">
           <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Abrir menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
               <Link href="/" className="mr-6 flex items-center space-x-2 mb-8">
                <Truck className="h-6 w-6 text-primary" />
                <span className="font-bold sm:inline-block font-headline">
                  CaçambaControl
                </span>
              </Link>
              <nav className="grid gap-6">
                {renderNavLinks(true)}
              </nav>
            </SheetContent>
          </Sheet>
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
