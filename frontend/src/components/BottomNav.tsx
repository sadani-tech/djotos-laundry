'use client';
import { ClipboardList, Gift, Menu, Users, Wallet } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/', label: 'Order', icon: ClipboardList, match: (p: string) => p === '/' || p.startsWith('/order') },
  { href: '/customer', label: 'Customer', icon: Users, match: (p: string) => p.startsWith('/customer') },
  { href: '/cashflow', label: 'Cashflow', icon: Wallet, match: (p: string) => p.startsWith('/cashflow') },
  { href: '/free', label: 'FREE', icon: Gift, match: (p: string) => p.startsWith('/free') },
  { href: '/lainnya', label: 'Lainnya', icon: Menu, match: (p: string) => p.startsWith('/lainnya') },
];

/** Navigasi bawah di HP; berubah jadi rel di kiri pada layar lebar (PC kasir). */
export default function BottomNav() {
  const path = usePathname();
  return (
    <nav aria-label="Menu utama" className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_12px_rgba(23,32,51,0.05)] md:inset-y-0 md:right-auto md:w-24 md:border-r md:border-t-0 md:shadow-none">
      <ul className="mx-auto flex max-w-xl md:h-full md:flex-col md:justify-start md:gap-2 md:pt-6">
        {ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = match(path);
          return (
            <li key={href} className="relative flex-1 md:flex-none">
              {active && <span aria-hidden className="absolute left-1/2 top-0 h-[3px] w-10 -translate-x-1/2 rounded-b-full bg-accent-500 md:left-0 md:top-1/2 md:h-10 md:w-[3px] md:-translate-y-1/2 md:translate-x-0 md:rounded-b-none md:rounded-r-full" />}
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${active ? 'text-brand-700' : 'text-slate-500 hover:text-brand-600'}`}
              >
                <span className={`flex h-8 w-14 items-center justify-center rounded-full ${active ? 'bg-brand-600 text-white' : ''}`}>
                  <Icon className="h-6 w-6" strokeWidth={active ? 2.4 : 2} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
