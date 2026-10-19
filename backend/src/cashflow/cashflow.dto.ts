import { PayMethod } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Matches, Min, MinLength } from 'class-validator';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateExpenseDto {
  @IsString() @MinLength(2, { message: 'Kategori pengeluaran wajib diisi' }) category: string;
  @IsOptional() @IsString() description?: string;
  @IsInt({ message: 'Nominal harus angka bulat (rupiah)' }) @Min(1, { message: 'Nominal minimal Rp 1' }) amount: number;
  @IsOptional() @IsEnum(PayMethod) method?: PayMethod;
  @IsOptional() @Matches(DATE_RE, { message: 'Tanggal harus YYYY-MM-DD' }) date?: string;
}

export class UpdateExpenseDto {
  @IsOptional() @IsString() @MinLength(2) category?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsInt() @Min(1) amount?: number;
  @IsOptional() @IsEnum(PayMethod) method?: PayMethod;
  @IsOptional() @Matches(DATE_RE) date?: string;
}
