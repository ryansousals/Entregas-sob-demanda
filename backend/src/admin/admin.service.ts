import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DeliveryStatus, Prisma, UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

const activeStatuses: DeliveryStatus[] = [
  DeliveryStatus.ASSIGNED,
  DeliveryStatus.PICKED_UP,
  DeliveryStatus.IN_TRANSIT,
];

const shiftSelection = {
  id: true,
  courierId: true,
  openedById: true,
  closedById: true,
  openedAt: true,
  closedAt: true,
  courier: { select: { id: true, user: { select: { name: true } } } },
  openedBy: { select: { name: true } },
  closedBy: { select: { name: true } },
} satisfies Prisma.CourierShiftSelect;

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const [
      totalDeliveries,
      activeDeliveries,
      deliveredDeliveries,
      cancelledDeliveries,
      pendingCouriers,
      availableCouriers,
      revenue,
    ] = await this.prisma.$transaction([
      this.prisma.delivery.count(),
      this.prisma.delivery.count({
        where: {
          status: {
            notIn: [DeliveryStatus.DELIVERED, DeliveryStatus.CANCELLED],
          },
        },
      }),
      this.prisma.delivery.count({
        where: { status: DeliveryStatus.DELIVERED },
      }),
      this.prisma.delivery.count({
        where: { status: DeliveryStatus.CANCELLED },
      }),
      this.prisma.courierProfile.count({ where: { isApproved: false } }),
      this.prisma.courierProfile.count({
        where: {
          isApproved: true,
          isAvailable: true,
          user: { role: UserRole.COURIER },
          shifts: { some: { closedAt: null } },
          deliveries: { none: { status: { in: activeStatuses } } },
        },
      }),
      this.prisma.delivery.aggregate({
        where: { status: DeliveryStatus.DELIVERED },
        _sum: { totalAmount: true },
      }),
    ]);

    return {
      totalDeliveries,
      activeDeliveries,
      deliveredDeliveries,
      cancelledDeliveries,
      pendingCouriers,
      availableCouriers,
      totalRevenue: (revenue._sum.totalAmount ?? new Prisma.Decimal(0)).toFixed(
        2,
      ),
    };
  }

  listUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async listCouriers() {
    const couriers = await this.prisma.courierProfile.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        userId: true,
        isApproved: true,
        isAvailable: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true, phone: true } },
        shifts: {
          orderBy: { openedAt: 'desc' },
          take: 20,
          select: shiftSelection,
        },
        _count: {
          select: { deliveries: { where: { status: { in: activeStatuses } } } },
        },
      },
    });

    return couriers.map(({ _count, ...courier }) => ({
      ...courier,
      activeDeliveries: _count.deliveries,
    }));
  }

  listShifts() {
    return this.prisma.courierShift.findMany({
      orderBy: { openedAt: 'desc' },
      take: 200,
      select: shiftSelection,
    });
  }

  private async lockCourier(tx: Prisma.TransactionClient, courierId: string) {
    const locked = await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT "id" FROM "CourierProfile" WHERE "id" = ${courierId} FOR UPDATE`,
    );
    if (locked.length === 0) {
      throw new NotFoundException('Motoboy não encontrado.');
    }
  }

  async openShift(courierId: string, openedById: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.lockCourier(tx, courierId);
        const courier = await tx.courierProfile.findUniqueOrThrow({
          where: { id: courierId },
          select: { isApproved: true, user: { select: { role: true } } },
        });
        if (!courier.isApproved || courier.user.role !== UserRole.COURIER) {
          throw new ConflictException(
            'Aprove o cadastro do motoboy antes de abrir um turno.',
          );
        }

        const currentShift = await tx.courierShift.findFirst({
          where: { courierId, closedAt: null },
          select: { id: true },
        });
        if (currentShift) {
          throw new ConflictException(
            'Este motoboy já possui um turno aberto.',
          );
        }

        const shift = await tx.courierShift.create({
          data: { courierId, openedById },
          select: shiftSelection,
        });
        await tx.courierProfile.update({
          where: { id: courierId },
          data: { isAvailable: true },
        });
        return shift;
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Este motoboy já possui um turno aberto.');
      }
      throw error;
    }
  }

  async closeShift(courierId: string, closedById: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockCourier(tx, courierId);
      const currentShift = await tx.courierShift.findFirst({
        where: { courierId, closedAt: null },
        select: { id: true },
      });
      if (!currentShift) {
        throw new ConflictException('Este motoboy não possui um turno aberto.');
      }

      const activeDeliveries = await tx.delivery.count({
        where: { courierId, status: { in: activeStatuses } },
      });
      if (activeDeliveries > 0) {
        throw new ConflictException(
          'Conclua ou cancele a entrega em andamento antes de fechar o turno.',
        );
      }

      const shift = await tx.courierShift.update({
        where: { id: currentShift.id },
        data: { closedAt: new Date(), closedById },
        select: shiftSelection,
      });
      await tx.courierProfile.update({
        where: { id: courierId },
        data: { isAvailable: false },
      });
      return shift;
    });
  }

  async listPendingCouriers() {
    return this.prisma.courierProfile.findMany({
      where: { isApproved: false },
      select: {
        id: true,
        isApproved: true,
        isAvailable: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async approveCourier(courierId: string) {
    return this.prisma.$transaction(async (tx) => {
      const courier = await tx.courierProfile.findUnique({
        where: { id: courierId },
        select: {
          id: true,
          userId: true,
          isApproved: true,
        },
      });

      if (!courier) {
        throw new NotFoundException('Motoboy não encontrado.');
      }

      if (courier.isApproved) {
        throw new ConflictException('Este motoboy já foi aprovado.');
      }

      // A condição também protege contra aprovações simultâneas e impede
      // que contas administrativas sejam convertidas em entregadores.
      const updatedUser = await tx.user.updateMany({
        where: {
          id: courier.userId,
          role: UserRole.CUSTOMER,
        },
        data: { role: UserRole.COURIER },
      });

      if (updatedUser.count !== 1) {
        throw new ConflictException(
          'O usuário não pode ser aprovado como motoboy.',
        );
      }

      const updatedCourier = await tx.courierProfile.updateMany({
        where: { id: courierId, isApproved: false },
        data: {
          isApproved: true,
          isAvailable: false,
        },
      });

      if (updatedCourier.count !== 1) {
        // Lançar a exceção reverte também a alteração do papel do usuário.
        throw new ConflictException('A solicitação já foi processada.');
      }

      return {
        message: 'Motoboy aprovado com sucesso.',
        courier: {
          id: courierId,
          isApproved: true,
          isAvailable: false,
        },
      };
    });
  }
}
