'use client';
import { Banknote, CalendarDays, ChevronRight, ClipboardList, History, KeyRound, LogOut, MessageCircle, Settings, ShirtIcon, Users, Award } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PageHeader, useConfirm } from '@/components/ui';
import { useAuth } from '@/lib/auth';

function Item({ href, icon, title, hint }: { href: string; icon: ReactNode; title: string; hint: string }) {
  return (
    <Link href={href} className="card flex items-center gap-4 p-4 active:bg-surface">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">{icon}</span>
      <span className="min-w-0 flex-1"><span className="block font-bold">{title}</span><span className="mt-0.5 block text-sm leading-snug text-slate-500">{hint}</span></span>
      <ChevronRight className="h-5 w-5 text-slate-300" />
    </Link>
  );
}

export default function MorePage() {
  const { user, isOwner, logout } = useAuth();
  const confirm = useConfirm();
  const out = async () => { if (await confirm({ title: 'Keluar dari aplikasi?', confirmText: 'Ya, keluar' })) logout(); };
  return (
    <div>
      <PageHeader title="Lainnya" />
      <div className="card mb-5 flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-xl font-bold text-white">{user?.name[0]}</span>
        <div><p className="font-bold">{user?.name}</p><p className="text-sm text-slate-500">{isOwner ? 'Owner' : 'Staff'} · @{user?.username}</p></div>
      </div>

      <div className="space-y-3">
        <Item href="/lainnya/bonus" icon={<Award />} title={isOwner ? 'Bonus Staff' : 'Bonus Saya'} hint={isOwner ? 'Rekap bonus semua staff per bulan' : 'Lihat bonus bulan ini'} />
        <Item href="/lainnya/rekap-harian" icon={<CalendarDays />} title="Rekap Harian Staff" hint="Kg yang dicuci per staff + rincian customer" />
        <Item href="/lainnya/wa" icon={<MessageCircle />} title="Log WhatsApp" hint="Pesan otomatis terkirim / gagal, kirim ulang" />
      </div>

      {isOwner && (
        <>
          <p className="mb-2 mt-6 text-sm font-bold uppercase tracking-wide text-slate-500">Khusus Owner</p>
          <div className="space-y-3">
            <Item href="/lainnya/staff" icon={<Users />} title="Staff & Performa" hint="Tambah akun staff, omzet & kg per staff" />
            <Item href="/lainnya/layanan" icon={<ShirtIcon />} title="Layanan & Harga" hint="Ubah harga, tambah atau nonaktifkan layanan" />
            <Item href="/lainnya/aturan-bonus" icon={<Banknote />} title="Aturan Bonus" hint="Atur bonus per kg / persen omzet" />
            <Item href="/lainnya/pengaturan" icon={<Settings />} title="Pengaturan" hint="Data toko, template WhatsApp, program FREE" />
            <Item href="/lainnya/riwayat" icon={<History />} title="Riwayat Perubahan" hint="Siapa mengubah status, pembayaran, harga" />
          </div>
        </>
      )}

      <div className="mt-6 space-y-3">
        <Item href="/lainnya/akun" icon={<KeyRound />} title="Ganti Password" hint="Ubah password akun Anda" />
        <button onClick={out} className="card flex w-full items-center gap-3 p-4 text-left text-red-600 active:bg-red-50"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-100"><LogOut /></span><span className="font-bold">Keluar</span></button>
      </div>
      <p className="mt-6 flex items-center justify-center gap-1 text-xs text-slate-400"><ClipboardList className="h-3 w-3" /> Djotos Laundry</p>
    </div>
  );
}
