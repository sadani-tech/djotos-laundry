import useSWR, { mutate as globalMutate, type SWRConfiguration } from 'swr';
import { fetcher } from './api';

/** Ambil data GET dari API. Kunci `null` = jangan ambil. */
export function useApi<T>(key: string | null, opts?: SWRConfiguration<T>) {
  return useSWR<T>(key, fetcher as (k: string) => Promise<T>, { revalidateOnFocus: true, dedupingInterval: 1500, ...opts });
}

/** Segarkan semua data setelah ada perubahan (order, bayar, dll.) supaya angka di semua halaman ikut berubah. */
export const refreshAll = () => globalMutate(() => true);
