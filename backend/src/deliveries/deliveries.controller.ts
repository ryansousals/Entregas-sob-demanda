import {
  Body,
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
import { DeliveriesService } from './deliveries.service';
import {
  AssignDeliveryDto,
  CreateDeliveryDto,
  QuoteDeliveryDto,
  UpdateDeliveryStatusDto,
} from './dto/delivery.dto';

@Controller('deliveries')
@UseGuards(JwtAuthGuard)
export class DeliveriesController {
  constructor(private readonly deliveries: DeliveriesService) {}

  @Get('pricing')
  pricing() {
    return this.deliveries.pricing();
  }

  @Post('quote')
  quote(@Body() dto: QuoteDeliveryDto) {
    return this.deliveries.quote(dto.distanceKm);
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateDeliveryDto) {
    return this.deliveries.create(request.user!, dto);
  }

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.deliveries.list(request.user!);
  }

  @Get('available')
  available(@Req() request: AuthenticatedRequest) {
    return this.deliveries.available(request.user!);
  }

  @Get(':id')
  detail(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.deliveries.detail(request.user!, id);
  }

  @Patch(':id/accept')
  accept(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.deliveries.accept(request.user!, id);
  }

  @Patch(':id/assign')
  assign(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignDeliveryDto,
  ) {
    return this.deliveries.assign(request.user!, id, dto.courierId);
  }

  @Patch(':id/status')
  updateStatus(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeliveryStatusDto,
  ) {
    return this.deliveries.updateStatus(request.user!, id, dto.status);
  }

  @Patch(':id/cancel')
  cancel(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.deliveries.cancel(request.user!, id);
  }
}
