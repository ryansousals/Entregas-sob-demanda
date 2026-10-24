
import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller('health')
export class DatabaseController {
    constructor(private readonly prisma: PrismaService) { }

    @Get('database')
    async checkDatabase() {
        const totalUsers = await this.prisma.user.count();

        return {
            status: 'connected',
            database: 'PostgreSQL',
            totalUsers,
        };
    }
}
