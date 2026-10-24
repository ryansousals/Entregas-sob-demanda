import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

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
