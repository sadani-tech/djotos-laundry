'use client';
import { ClipboardList, Menu, Plus, Users, Wallet } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoMark } from './ui';

// FREE ada di dalam menu Lainnya. Tombol "Order Baru" ada di tengah (HP) atau mengambang di kanan bawah (PC).
const LEFT = [
  { href: '/', label: 'Order', icon: ClipboardList, match: (p: string) => p === '/' || (p.startsWith('/order') && p !== '/order/baru') },
  { href: '/customer', label: 'Customer', icon: Users, match: (p: string) => p.startsWith('/customer') },
];
const RIGHT = [
  { href: '/cashflow', label: 'Cashflow', icon: Wallet, match: (p: string) => p.startsWith('/cashflow') },
  { href: '/lainnya', label: 'Lainnya', icon: Menu, match: (p: string) => p.startsWith('/lainnya') || p.startsWith('/free') },
];

/** Navigasi bawah di HP (4 menu + tombol Order Baru di tengah); rel di kiri pada layar lebar (PC kasir). */
export default function BottomNav() {
  const path = usePathname();
  const creating = path === '/order/baru';

  const NavItem = ({ href, label, icon: Icon, match }: (typeof LEFT)[number]) => {
    const active = match(path);
    return (
      <li className="flex-1 md:flex-none">
        <Link
          href={href}
          aria-current={active ? 'page' : undefined}
          className={`group relative flex min-h-[4.15rem] flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-bold transition md:min-h-[4.5rem] md:text-xs ${active ? 'text-brand-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
        >
          <span className={`flex h-8 w-12 items-center justify-center rounded-xl transition ${active ? 'bg-brand-100' : 'group-hover:bg-white'}`}>
            <Icon className="h-[1.35rem] w-[1.35rem]" strokeWidth={active ? 2.5 : 2} />
          </span>
          {label}
          {active && <span className="absolute -bottom-px h-1 w-5 rounded-full bg-accent-500 md:bottom-auto md:left-0 md:h-6 md:w-1" />}
        </Link>
      </li>
    );
  };

  return (
    <>
      <nav aria-label="Menu utama" className="no-print fixed inset-x-3 bottom-3 z-30 rounded-[1.4rem] border border-white/80 bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-float backdrop-blur-xl md:inset-y-0 md:left-0 md:right-auto md:bottom-0 md:w-28 md:rounded-none md:border-y-0 md:border-l-0 md:border-r md:border-line/80 md:bg-white/90 md:px-3 md:shadow-none">
        <div className="hidden flex-col items-center gap-2 border-b border-slate-100 py-5 md:flex">
          <LogoMark />
          <span className="text-xs font-extrabold tracking-tight text-slate-800">DJOTOS</span>
        </div>
        <ul className="mx-auto flex max-w-xl items-end md:h-auto md:flex-col md:items-stretch md:gap-1.5 md:pt-4">
          {LEFT.map((i) => <NavItem key={i.href} {...i} />)}
          {/* Tombol utama di tengah (HP saja): kontras biru + cincin kuning, menonjol di atas bar */}
          <li className="flex flex-1 justify-center md:hidden">
            <Link
              href="/order/baru"
              aria-label="Buat order baru"
              aria-current={creating ? 'page' : undefined}
              className="group -mt-7 flex flex-col items-center gap-1 pb-1.5 text-[11px] font-extrabold text-brand-700"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-600 text-white shadow-float ring-4 ring-accent-500 transition active:scale-95 group-hover:bg-brand-700">
                <Plus className="h-8 w-8" strokeWidth={3} />
              </span>
              Order Baru
            </Link>
          </li>
          {RIGHT.map((i) => <NavItem key={i.href} {...i} />)}
        </ul>
      </nav>

      {/* Tombol mengambang di PC: buat order baru dari halaman mana pun */}
      {!creating && (
        <Link
          href="/order/baru"
          aria-label="Buat order baru"
          title="Buat order baru"
          className="no-print fixed bottom-8 right-8 z-30 hidden h-16 w-16 items-center justify-center rounded-full bg-brand-600 text-white shadow-float ring-4 ring-accent-500 transition hover:scale-105 hover:bg-brand-700 active:scale-95 md:flex"
        >
          <Plus className="h-8 w-8" strokeWidth={3} />
        </Link>
      )}
    </>
  );
}
