import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('couriers/pending')
  listPendingCouriers() {
    return this.adminService.listPendingCouriers();
  }

  @Patch('couriers/:id/approve')
  approveCourier(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.approveCourier(id);
  }
}
