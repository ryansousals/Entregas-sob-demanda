import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller('health')
export class DatabaseController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('database')
  async checkDatabase() {
    await this.prisma.$queryRaw`SELECT 1`;

    return {
      status: 'connected',
      database: 'PostgreSQL',
    };
  }
}
