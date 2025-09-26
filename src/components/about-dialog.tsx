
'use client';

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
  const appVersion = process.env.npm_package_version || "1.0.0";

  return (
    <Dialog>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
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
            <Button asChild variant="link" className="p-0 h-auto">
                 <Link href="/privacy-policy">
                    Ver Política de Privacidade
                </Link>
            </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
