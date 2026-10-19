import { Body, Controller, Delete, Get, Module, Param, ParseIntPipe, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthUser, CurrentUser } from '../common/auth';
import { todayStr } from '../common/time';
import { ReportsModule, ExcelService } from '../reports/excel.service';
import { CreateExpenseDto, UpdateExpenseDto } from './cashflow.dto';
import { CashflowService } from './cashflow.service';

@Controller()
export class CashflowController {
  constructor(private cashflow: CashflowService, private excel: ExcelService) {}

  @Get('cashflow/summary')
  summary(@CurrentUser() u: AuthUser, @Query('period') period = 'day', @Query('date') date?: string, @Query('staffId') staffId?: string) {
    return this.cashflow.summary(u, { period, date, staffId: staffId ? Number(staffId) : undefined });
  }

  @Get('cashflow/entries')
  entries(@CurrentUser() u: AuthUser, @Query('period') period = 'day', @Query('date') date?: string, @Query('staffId') staffId?: string) {
    return this.cashflow.entries(u, { period, date, staffId: staffId ? Number(staffId) : undefined });
  }

  @Get('cashflow/export')
  async export(@CurrentUser() u: AuthUser, @Res({ passthrough: true }) res: Response, @Query('period') period = 'day', @Query('date') date?: string, @Query('staffId') staffId?: string) {
    const buf = await this.cashflow.exportExcel(u, { period, date, staffId: staffId ? Number(staffId) : undefined });
    res.setHeader('Content-Disposition', `attachment; filename="cashflow-${period}-${date ?? todayStr()}.xlsx"`);
    return this.excel.file(buf);
  }

  @Post('expenses')
  create(@Body() dto: CreateExpenseDto, @CurrentUser() u: AuthUser) {
    return this.cashflow.createExpense(dto, u);
  }

  @Patch('expenses/:id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateExpenseDto, @CurrentUser() u: AuthUser) {
    return this.cashflow.updateExpense(id, dto, u);
  }

  @Delete('expenses/:id')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.cashflow.deleteExpense(id, u);
  }
}

@Module({ imports: [ReportsModule], controllers: [CashflowController], providers: [CashflowService], exports: [CashflowService] })
export class CashflowModule {}
