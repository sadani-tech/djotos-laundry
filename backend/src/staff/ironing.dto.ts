import { Transform } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class IroningEntryDto {
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Tanggal harus berformat YYYY-MM-DD' }) date: string;
  @Transform(({ value }) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value)
  @IsString() @MinLength(1, { message: 'Nama customer wajib diisi' }) @MaxLength(100) customerName: string;
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Berat setrika maksimal 2 angka desimal' })
  @Min(0.01, { message: 'Berat setrika minimal 0,01 kg' }) @Max(10000) kg: number;
  @IsOptional() @IsInt() @Min(1) staffId?: number;
}
