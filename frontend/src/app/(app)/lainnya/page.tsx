'use client';
import { Banknote, CalendarDays, ChevronRight, ClipboardList, History, KeyRound, LogOut, MessageCircle, Settings, ShirtIcon, Users, Award } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PageHeader, useConfirm } from '@/components/ui';
import { useAuth } from '@/lib/auth';

function Item({ href, icon, title, hint }: { href: string; icon: ReactNode; title: string; hint: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-slate-50 active:bg-slate-100">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">{icon}</span>
      <span className="min-w-0 flex-1"><span className="block font-bold text-slate-900">{title}</span><span className="block truncate text-sm text-slate-500">{hint}</span></span>
      <ChevronRight className="h-5 w-5 text-slate-300" />
    </Link>
  );
}

export default function MorePage() {
  const { user, isOwner, logout } = useAuth();
  const confirm = useConfirm();
  const out = async () => { if (await confirm({ title: 'Keluar dari aplikasi?', confirmText: 'Ya, keluar' })) logout(); };
  return (
    <div className="animate-fade-up">
      <PageHeader title="Lainnya" subtitle="Akun dan pengaturan" />
      <div className="card relative mb-5 flex items-center gap-3 overflow-hidden border-brand-700 bg-brand-700 text-white">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-xl font-extrabold ring-1 ring-white/20">{user?.name[0]}</span>
        <div className="relative min-w-0"><p className="truncate text-lg font-extrabold">{user?.name}</p><p className="truncate text-sm text-brand-100">{isOwner ? 'Owner' : 'Staff'} · @{user?.username}</p></div>
      </div>

      <p className="eyebrow mb-2">Operasional</p>
      <div className="card divide-y divide-line overflow-hidden p-0">
        <Item href="/lainnya/bonus" icon={<Award />} title={isOwner ? 'Bonus Staff' : 'Bonus Saya'} hint={isOwner ? 'Rekap bonus semua staff per bulan' : 'Lihat bonus bulan ini'} />
        <Item href="/lainnya/rekap-harian" icon={<CalendarDays />} title="Rekap Harian Staff" hint="Kg yang dicuci per staff + rincian customer" />
        <Item href="/lainnya/wa" icon={<MessageCircle />} title="Log WhatsApp" hint="Pesan otomatis terkirim / gagal, kirim ulang" />
      </div>

      {isOwner && (
        <>
          <p className="eyebrow mb-2 mt-6">Khusus Owner</p>
          <div className="card divide-y divide-line overflow-hidden p-0">
            <Item href="/lainnya/staff" icon={<Users />} title="Staff & Performa" hint="Tambah akun staff, omzet & kg per staff" />
            <Item href="/lainnya/layanan" icon={<ShirtIcon />} title="Layanan & Harga" hint="Ubah harga, tambah atau nonaktifkan layanan" />
            <Item href="/lainnya/aturan-bonus" icon={<Banknote />} title="Aturan Bonus" hint="Atur bonus per kg / persen omzet" />
            <Item href="/lainnya/pengaturan" icon={<Settings />} title="Pengaturan" hint="Data toko, template WhatsApp, program FREE" />
            <Item href="/lainnya/riwayat" icon={<History />} title="Riwayat Perubahan" hint="Siapa mengubah status, pembayaran, harga" />
          </div>
        </>
      )}

      <p className="eyebrow mb-2 mt-6">Akun</p>
      <div className="card divide-y divide-line overflow-hidden p-0">
        <Item href="/lainnya/akun" icon={<KeyRound />} title="Ganti Password" hint="Ubah password akun Anda" />
        <button onClick={out} className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-red-600 transition hover:bg-red-50 active:bg-red-100"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-100"><LogOut /></span><span className="font-bold">Keluar dari aplikasi</span></button>
      </div>
      <p className="mt-6 flex items-center justify-center gap-1 text-xs text-slate-400"><ClipboardList className="h-3 w-3" /> Djotos Laundry</p>
    </div>
  );
}
