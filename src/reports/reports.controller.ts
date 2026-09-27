import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserDocument } from '../users/schemas/user.schema';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // POST /api/reports { contentType, targetId, reason, comment?, parentType?, parentId? }
  @Post()
  create(@CurrentUser() user: UserDocument, @Body() dto: CreateReportDto) {
    return this.reportsService.create(user, dto);
  }
}

// Review queue for admins, alongside the other /api/admin routes.
@Controller('admin/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // GET /api/admin/reports?status=pending|resolved
  @Get()
  list(@Query('status') status?: string) {
    return this.reportsService.list(status);
  }

  @Patch(':id/resolve')
  resolve(@Param('id') id: string) {
    return this.reportsService.setStatus(id, 'resolved');
  }

  @Patch(':id/reopen')
  reopen(@Param('id') id: string) {
    return this.reportsService.setStatus(id, 'pending');
  }
}
