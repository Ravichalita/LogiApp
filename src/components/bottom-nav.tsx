'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutGrid, Users, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';


const navLinks = [
  { href: '/', label: 'Painel', icon: Home },
  { href: '/dumpsters', label: 'Caçambas', icon: LayoutGrid },
  { href: '/clients', label: 'Clientes', icon: Users },
  { href: '/stats', label: 'Dados', icon: BarChart3 },
];

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t">
      <div className="grid h-16 grid-cols-4">
        {navLinks.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-col items-center justify-center gap-1 text-sm font-medium transition-colors',
              pathname === href
                ? 'text-primary'
                : 'text-muted-foreground hover:text-primary'
            )}
          >
            <Icon className="h-6 w-6" />
            <span>{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
