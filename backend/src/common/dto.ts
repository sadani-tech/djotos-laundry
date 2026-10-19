import { Transform } from 'class-transformer';

/** Ubah '' menjadi undefined supaya @IsOptional() bekerja untuk input form kosong. */
export const EmptyToUndefined = () => Transform(({ value }) => (value === '' || value === null ? undefined : value));
