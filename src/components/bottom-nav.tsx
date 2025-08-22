
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutGrid, Users, Settings, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';


const baseNavLinks = [
  { href: '/', label: 'Painel', icon: Home },
  { href: '/dumpsters', label: 'Caçambas', icon: LayoutGrid },
  { href: '/clients', label: 'Clientes', icon: Users },
];

const financeLink = { href: '/finance', label: 'Financeiro', icon: DollarSign };
const teamLink = { href: '/team', label: 'Equipe', icon: Settings };

export function BottomNav() {
  const pathname = usePathname();
  const { user, userAccount } = useAuth();
  const isAdmin = userAccount?.role === 'admin';
  const permissions = userAccount?.permissions;

  if (!user) {
    return null;
  }
  
  const navLinks = [...baseNavLinks];

  if(isAdmin || permissions?.canAccessStats) {
      navLinks.push(financeLink);
  }

  if(isAdmin || permissions?.canAccessTeam) {
    navLinks.push(teamLink)
  }

  const getGridColsClass = () => {
    switch (navLinks.length) {
        case 5: return "grid-cols-5";
        case 4: return "grid-cols-4";
        default: return "grid-cols-3";
    }
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t">
      <div className={cn("grid h-16", getGridColsClass())}>
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
            <span className="text-xs">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
