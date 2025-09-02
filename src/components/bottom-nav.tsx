

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Container, Users, Truck, Workflow } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';


const allNavLinks = [
  { href: '/', label: 'Aluguéis', icon: Home, permission: 'canAccessRentals' as const },
  { href: '/dumpsters', label: 'Caçambas', icon: Container, permission: 'canAccessRentals' as const },
  { href: '/operations', label: 'Operações', icon: Workflow, permission: 'canAccessOperations' as const },
  { href: '/fleet', label: 'Frota', icon: Truck, permission: 'canAccessFleet' as const },
  { href: '/clients', label: 'Clientes', icon: Users, permission: 'canAccessClients' as const },
];


export function BottomNav() {
  const pathname = usePathname();
  const { user, userAccount, isSuperAdmin } = useAuth();

  if (!user) {
    return null;
  }

  const permissions = userAccount?.permissions;
  
  const visibleLinks = allNavLinks.filter(link => {
    if (isSuperAdmin) return true;
    if (!permissions) return false;
    return permissions[link.permission];
  });

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t">
      <div className="grid h-16" style={{ gridTemplateColumns: `repeat(${visibleLinks.length > 0 ? visibleLinks.length : 1}, 1fr)`}}>
        {visibleLinks.map(({ href, label, icon: Icon }) => (
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
            <Icon className="h-5 w-5" />
            <span className="text-[10px]">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
