import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

const profileSelection = {
  id: true,
  userId: true,
  isApproved: true,
  isAvailable: true,
  createdAt: true,
  user: {
    select: { id: true, name: true, email: true, phone: true },
  },
  shifts: {
    orderBy: { openedAt: 'desc' },
    take: 100,
    select: {
      id: true,
      courierId: true,
      openedById: true,
      closedById: true,
      openedAt: true,
      closedAt: true,
      openedBy: { select: { name: true } },
      closedBy: { select: { name: true } },
    },
  },
} satisfies Prisma.CourierProfileSelect;

@Injectable()
export class CouriersService {
  constructor(private readonly prisma: PrismaService) {}

  async apply(userId: string, role: string) {
    if (role !== UserRole.CUSTOMER) {
      throw new ForbiddenException(
        'Somente clientes podem solicitar o cadastro de motoboy.',
      );
    }

    try {
      return await this.prisma.courierProfile.create({
        data: { userId, isApproved: false, isAvailable: false },
        select: profileSelection,
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Você já possui uma solicitação de cadastro de motoboy.',
        );
      }
      throw error;
    }
  }

  async getMyProfile(userId: string) {
    return {
      profile: await this.prisma.courierProfile.findUnique({
        where: { userId },
        select: profileSelection,
      }),
    };
  }
}
