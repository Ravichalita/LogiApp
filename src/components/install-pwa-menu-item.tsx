
'use client';

import { useAuth } from '@/context/auth-context';
import { Download } from 'lucide-react';
import { DropdownMenuItem } from './ui/dropdown-menu';

export function InstallPwaMenuItem() {
  const { deferredPrompt, handleInstall, isPwaInstalled } = useAuth();

  if (!deferredPrompt || isPwaInstalled) {
    return null;
  }

  const handleInstallClick = (e: Event) => {
    e.preventDefault();
    handleInstall();
  };

  return (
    <DropdownMenuItem onSelect={handleInstallClick}>
      <Download className="mr-2 h-4 w-4" />
      <span>Instalar App</span>
    </DropdownMenuItem>
  );
}
