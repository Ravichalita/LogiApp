
'use client';

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Info } from "lucide-react";
import Link from "next/link";
import { Button } from "./ui/button";

export function AboutDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const appVersion = process.env.npm_package_version || "1.0.0";

  const handleLinkClick = () => {
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => {
          e.preventDefault();
          setIsOpen(true);
        }}>
          <Info className="mr-2 h-4 w-4" />
          <span>Sobre o LogiApp</span>
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sobre o LogiApp</DialogTitle>
          <DialogDescription>
            Informações sobre o aplicativo e links úteis.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
            <p className="text-sm">
                <strong>Versão:</strong> {appVersion}
            </p>
            <div className="flex flex-col items-start gap-2">
                <Button asChild variant="link" className="p-0 h-auto" onClick={handleLinkClick}>
                    <Link href="/privacy-policy">
                        Ver Política de Privacidade
                    </Link>
                </Button>
                 <Button asChild variant="link" className="p-0 h-auto" onClick={handleLinkClick}>
                    <Link href="/terms-of-service">
                        Ver Termos de Serviço
                    </Link>
                </Button>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
