import { OrderStatus, PayMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

export class OrderItemDto {
  @IsInt({ message: 'Layanan tidak valid' }) serviceId: number;
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Berat/jumlah harus angka' }) @Min(0.1, { message: 'Berat/jumlah harus lebih dari 0' }) @Max(1000, { message: 'Berat/jumlah terlalu besar' }) qty: number;
}

export class PayNowDto {
  @IsEnum(PayMethod, { message: 'Metode bayar harus CASH atau QRIS' }) method: PayMethod;
  @IsOptional() @IsInt() @Min(1) amount?: number;
}

export class CreateOrderDto {
  @IsInt({ message: 'Pilih customer terlebih dahulu' }) customerId: number;
  @IsArray() @ArrayMinSize(1, { message: 'Pilih minimal satu layanan' }) @ValidateNested({ each: true }) @Type(() => OrderItemDto) items: OrderItemDto[];
  @IsOptional() @IsInt() @Min(0) discount?: number;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @ValidateNested() @Type(() => PayNowDto) payment?: PayNowDto;
}

export class UpdateOrderDto {
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsInt() @Min(0) discount?: number;
}

export class ChangeStatusDto {
  @IsEnum(OrderStatus, { message: 'Status tidak valid' }) status: OrderStatus;
}

export class CancelOrderDto {
  @IsOptional() @IsString() reason?: string;
}
