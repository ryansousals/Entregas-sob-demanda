import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CouriersController } from './couriers.controller';
import { CouriersService } from './couriers.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [CouriersController],
  providers: [CouriersService],
})
export class CouriersModule {}
