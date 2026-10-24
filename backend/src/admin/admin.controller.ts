import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('summary')
  getSummary() {
    return this.adminService.getSummary();
  }

  @Get('users')
  listUsers() {
    return this.adminService.listUsers();
  }

  @Get('couriers')
  listCouriers() {
    return this.adminService.listCouriers();
  }

  @Get('shifts')
  listShifts() {
    return this.adminService.listShifts();
  }

  @Get('couriers/pending')
  listPendingCouriers() {
    return this.adminService.listPendingCouriers();
  }

  @Patch('couriers/:id/approve')
  approveCourier(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.approveCourier(id);
  }

  @Post('couriers/:id/shifts/open')
  openShift(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.adminService.openShift(id, request.user!.id);
  }

  @Post('couriers/:id/shifts/close')
  closeShift(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.adminService.closeShift(id, request.user!.id);
  }
}
