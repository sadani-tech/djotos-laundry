'use client';
import { useEffect, useState } from 'react';
import { Button, Field, Sheet, useAction } from './ui';
import { api } from '@/lib/api';
import { refreshAll } from '@/lib/swr';
import type { Customer } from '@/lib/types';

export function NewCustomerSheet({ open, onClose, onCreated, initialName = '' }: { open: boolean; onClose: () => void; onCreated: (c: Customer) => void; initialName?: string }) {
  const { run, busy } = useAction();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  useEffect(() => { if (open) { setName(initialName); setPhone(''); } }, [open, initialName]);
  const save = async () => {
    const c = await run(() => api.post<Customer>('/customers', { name, phone: phone || undefined }));
    if (c) { refreshAll(); onCreated({ ...c, orderCount: 0, totalKg: 0, totalSpent: 0, unpaid: 0, lastOrderAt: null, free: { count: 0, threshold: 9, eligible: false } }); }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Customer baru">
      <Field label="Nama"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Bu Win" autoFocus /></Field>
      <Field label="No. WhatsApp" hint="Dipakai untuk kirim pesan otomatis saat cucian selesai. Boleh dikosongkan.">
        <input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="081234567890" />
      </Field>
      <Button size="lg" className="w-full" loading={busy} disabled={name.trim().length < 2} onClick={save}>Simpan Customer</Button>
    </Sheet>
  );
}


/** Ubah data customer (nama, WA, catatan). */
export function EditCustomerSheet({ open, onClose, customer, onSaved }: { open: boolean; onClose: () => void; customer: Pick<Customer, 'id' | 'name' | 'phone' | 'address'>; onSaved: () => void }) {
  const { run, busy } = useAction();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  useEffect(() => {
    if (open) { setName(customer.name); setPhone(customer.phone ? '0' + customer.phone.slice(2) : ''); setAddress(customer.address ?? ''); }
  }, [open, customer]);
  const save = async () => {
    const r = await run(() => api.patch(`/customers/${customer.id}`, { name, phone, address }), 'Data customer disimpan');
    if (r) { refreshAll(); onSaved(); }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Ubah data customer">
      <Field label="Nama"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="No. WhatsApp"><input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="081234567890" /></Field>
      <Field label="Alamat (opsional)"><input className="input" value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
      <Button size="lg" className="w-full" loading={busy} disabled={name.trim().length < 2} onClick={save}>Simpan</Button>
    </Sheet>
  );
}
