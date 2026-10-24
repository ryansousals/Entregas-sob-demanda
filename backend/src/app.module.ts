import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseController } from './database.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { CouriersModule } from './couriers/couriers.module';
import { DeliveriesModule } from './deliveries/deliveries.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    AdminModule,
    CouriersModule,
    DeliveriesModule,
  ],
  controllers: [AppController, DatabaseController],
  providers: [AppService],
})
export class AppModule {}
