
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardList, Users, Megaphone, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { CacambaIcon } from '@/components/icons/cacamba-icon';

const baseNavLinks = [
  { href: '/', label: 'OS', icon: ClipboardList },
  { href: '/dumpsters', label: 'Caçambas', icon: CacambaIcon },
  { href: '/clients', label: 'Clientes', icon: Users },
  { href: '/trucks', label: 'Caminhões', icon: Truck },
];

const notificationsLink = { href: '/notifications-studio', label: 'Notificações', icon: Megaphone };

export function BottomNav() {
  const pathname = usePathname();
  const { user, userAccount, isSuperAdmin } = useAuth();
  const isAdmin = userAccount?.role === 'admin' || userAccount?.role === 'owner';
  const permissions = userAccount?.permissions;

  if (!user) {
    return null;
  }

  const navLinks = [...baseNavLinks];

  if (isSuperAdmin || isAdmin || permissions?.canAccessNotificationsStudio) {
    navLinks.push(notificationsLink);
  }

  const getGridColsClass = () => {
    switch (navLinks.length) {
        case 6: return "grid-cols-6";
        case 5: return "grid-cols-5";
        case 4: return "grid-cols-4";
        default: return "grid-cols-3";
    }
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t">
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
            <span className="text-[10px]">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
