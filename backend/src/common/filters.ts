import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** Ubah error database yang mentah menjadi pesan yang ramah. */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(e: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const map: Record<string, [number, string]> = {
      P2002: [HttpStatus.CONFLICT, 'Data tersebut sudah ada'],
      P2025: [HttpStatus.NOT_FOUND, 'Data tidak ditemukan'],
      P2003: [HttpStatus.BAD_REQUEST, 'Data terkait tidak valid'],
    };
    const [status, message] = map[e.code] ?? [HttpStatus.INTERNAL_SERVER_ERROR, 'Terjadi kesalahan di server, coba lagi'];
    res.status(status).json({ statusCode: status, message, error: e.code });
  }
}
