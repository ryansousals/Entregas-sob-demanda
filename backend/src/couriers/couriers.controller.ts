import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { CouriersService } from './couriers.service';

@Controller('couriers')
@UseGuards(JwtAuthGuard)
export class CouriersController {
  constructor(private readonly couriersService: CouriersService) {}

  @Post('apply')
  apply(@Req() request: AuthenticatedRequest) {
    return this.couriersService.apply(request.user!.id, request.user!.role);
  }

  @Get('me')
  getMyProfile(@Req() request: AuthenticatedRequest) {
    return this.couriersService.getMyProfile(request.user!.id);
  }
}
