
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Truck, Users, Cog, Container, Workflow, DollarSign, Map } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';


const allNavLinks = [
  { href: '/os', label: 'OS', icon: Workflow, permission: ['canAccessRentals', 'canAccessOperations'] as const },
  { href: '/dumpsters', label: 'Caçambas', icon: Container, permission: ['canAccessRentals'] as const },
  { href: '/fleet', label: 'Frota', icon: Truck, permission: ['canAccessFleet'] as const },
  { href: '/clients', label: 'Clientes', icon: Users, permission: ['canAccessClients'] as const },
  { href: '/finance', label: 'Financeiro', icon: DollarSign, permission: ['canAccessFinance'] as const },
];


export function BottomNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const { user, userAccount, isSuperAdmin } = useAuth();

  if (!user) {
    return null;
  }

  const permissions = userAccount?.permissions;
  
  const visibleLinks = allNavLinks.filter(link => {
    if (isSuperAdmin) return true;
    if (!permissions) return false;
    // Link is visible if user has permission for at least one of the required permissions
    return link.permission.some(p => permissions[p]);
  });

  return (
    <nav className={cn("fixed bottom-0 left-0 right-0 z-50 bg-card border-t", className)}>
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
