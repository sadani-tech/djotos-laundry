import { BadRequestException, NotFoundException } from '@nestjs/common';

export const bad = (msg: string) => new BadRequestException(msg);
export const notFound = (what: string) => new NotFoundException(`${what} tidak ditemukan`);

export const rupiah = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');
