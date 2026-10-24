import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeliveryStatus, Prisma, UserRole } from '@prisma/client';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateDeliveryDto,
  UpdateDeliveryStatusDto,
} from './dto/delivery.dto';

type Actor = NonNullable<AuthenticatedRequest['user']>;
const activeStatuses: DeliveryStatus[] = [
  DeliveryStatus.ASSIGNED,
  DeliveryStatus.PICKED_UP,
  DeliveryStatus.IN_TRANSIT,
];
const detailSelect = {
  id: true,
  customerId: true,
  courierId: true,
  pickupAddress: true,
  dropoffAddress: true,
  pickupReference: true,
  dropoffReference: true,
  recipientName: true,
  recipientPhone: true,
  packageDescription: true,
  distanceKm: true,
  totalAmount: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  customer: {
    select: {
      id: true,
      userId: true,
      user: { select: { id: true, name: true, email: true, phone: true } },
    },
  },
  courier: {
    select: {
      id: true,
      userId: true,
      user: { select: { id: true, name: true, phone: true } },
    },
  },
  events: {
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      status: true,
      note: true,
      createdAt: true,
    },
  },
} satisfies Prisma.DeliverySelect;

@Injectable()
export class DeliveriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  pricing() {
    return {
      baseFee: this.priceSetting('DELIVERY_BASE_FEE', 10),
      perKm: this.priceSetting('DELIVERY_PER_KM', 2),
      currency: 'BRL' as const,
    };
  }

  private priceSetting(key: string, fallback: number) {
    const value = Number(this.config.get<string>(key) ?? fallback);
    if (!Number.isFinite(value) || value < 0 || value > 10000) {
      throw new BadRequestException(
        'A tabela de preços está configurada incorretamente.',
      );
    }
    return value;
  }

  quote(distanceKm: number) {
    if (!Number.isFinite(distanceKm) || distanceKm < 0.1 || distanceKm > 200) {
      throw new BadRequestException(
        'A distância deve ficar entre 0,1 e 200 km.',
      );
    }
    const pricing = this.pricing();
    const total = new Prisma.Decimal(pricing.baseFee)
      .plus(new Prisma.Decimal(pricing.perKm).mul(distanceKm))
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    return {
      distanceKm,
      totalAmount: total.toFixed(2),
      currency: 'BRL' as const,
    };
  }

  async create(actor: Actor, dto: CreateDeliveryDto) {
    if (actor.role !== UserRole.CUSTOMER && actor.role !== UserRole.COURIER) {
      throw new ForbiddenException(
        'Somente clientes podem solicitar uma entrega.',
      );
    }
    const customer = await this.prisma.customerProfile.findUnique({
      where: { userId: actor.id },
      select: { id: true },
    });
    if (!customer) {
      throw new ForbiddenException(
        'Este usuário não possui um perfil de cliente.',
      );
    }
    const quote = this.quote(dto.distanceKm);
    return this.prisma.delivery.create({
      data: {
        customerId: customer.id,
        pickupAddress: dto.pickupAddress,
        dropoffAddress: dto.dropoffAddress,
        pickupReference: dto.pickupReference,
        dropoffReference: dto.dropoffReference,
        recipientName: dto.recipientName,
        recipientPhone: dto.recipientPhone,
        packageDescription: dto.packageDescription,
        distanceKm: dto.distanceKm,
        totalAmount: quote.totalAmount,
        status: DeliveryStatus.SEARCHING,
        events: {
          create: {
            status: DeliveryStatus.SEARCHING,
            actorId: actor.id,
            note: 'Pedido criado. Aguardando um motoboy em serviço.',
          },
        },
      },
      select: detailSelect,
    });
  }

  async list(actor: Actor) {
    const where: Prisma.DeliveryWhereInput =
      actor.role === UserRole.ADMIN
        ? {}
        : {
            OR: [
              { customer: { userId: actor.id } },
              ...(actor.role === UserRole.COURIER
                ? [{ courier: { userId: actor.id } }]
                : []),
            ],
          };
    return this.prisma.delivery.findMany({
      where,
      select: detailSelect,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async available(actor: Actor) {
    if (actor.role !== UserRole.COURIER) {
      throw new ForbiddenException(
        'A fila é exclusiva para motoboys aprovados em serviço.',
      );
    }
    const courier = await this.prisma.courierProfile.findUnique({
      where: { userId: actor.id },
      select: {
        isApproved: true,
        isAvailable: true,
        shifts: { where: { closedAt: null }, take: 1, select: { id: true } },
      },
    });
    if (
      !courier?.isApproved ||
      !courier.isAvailable ||
      courier.shifts.length === 0
    ) {
      throw new ForbiddenException(
        'Peça ao administrador para abrir seu turno antes de consultar a fila.',
      );
    }
    // Contatos pessoais só são liberados ao motoboy que aceitar o pedido.
    return this.prisma.delivery.findMany({
      where: {
        status: DeliveryStatus.SEARCHING,
        courierId: null,
        customer: { userId: { not: actor.id } },
      },
      select: {
        id: true,
        customerId: true,
        courierId: true,
        pickupAddress: true,
        dropoffAddress: true,
        pickupReference: true,
        dropoffReference: true,
        packageDescription: true,
        distanceKm: true,
        totalAmount: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
  }

  async detail(actor: Actor, id: string) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id },
      select: detailSelect,
    });
    if (!delivery) throw new NotFoundException('Entrega não encontrada.');
    if (
      actor.role !== UserRole.ADMIN &&
      delivery.customer.userId !== actor.id &&
      delivery.courier?.userId !== actor.id
    ) {
      throw new ForbiddenException('Você não tem acesso a esta entrega.');
    }
    return delivery;
  }

  async accept(actor: Actor, id: string) {
    if (actor.role !== UserRole.COURIER)
      throw new ForbiddenException('Somente motoboys podem aceitar entregas.');
    const courier = await this.prisma.courierProfile.findUnique({
      where: { userId: actor.id },
      select: { id: true },
    });
    if (!courier)
      throw new ForbiddenException('Perfil de motoboy não encontrado.');
    return this.claim(actor, id, courier.id);
  }

  async assign(actor: Actor, id: string, courierId: string) {
    if (actor.role !== UserRole.ADMIN)
      throw new ForbiddenException(
        'Atribuição permitida somente ao administrador.',
      );
    return this.claim(actor, id, courierId);
  }

  private async claim(actor: Actor, id: string, courierId: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // A mesma trava é usada para abrir/fechar turnos. Não há janela entre
        // conferir disponibilidade e atribuir a entrega.
        const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "CourierProfile" WHERE id = ${courierId} FOR UPDATE
        `;
        if (locked.length === 0)
          throw new NotFoundException('Motoboy não encontrado.');
        const courier = await tx.courierProfile.findUniqueOrThrow({
          where: { id: courierId },
          select: {
            isApproved: true,
            isAvailable: true,
            userId: true,
            user: { select: { role: true } },
            shifts: {
              where: { closedAt: null },
              take: 1,
              select: { id: true },
            },
          },
        });
        if (
          !courier.isApproved ||
          !courier.isAvailable ||
          courier.user.role !== UserRole.COURIER ||
          courier.shifts.length === 0
        ) {
          throw new ConflictException(
            'O motoboy precisa estar aprovado e com turno aberto.',
          );
        }
        const active = await tx.delivery.count({
          where: { courierId, status: { in: activeStatuses } },
        });
        if (active > 0)
          throw new ConflictException(
            'O motoboy já possui uma entrega em andamento.',
          );
        const delivery = await tx.delivery.findUnique({
          where: { id },
          select: { customer: { select: { userId: true } } },
        });
        if (!delivery) throw new NotFoundException('Entrega não encontrada.');
        if (delivery.customer.userId === courier.userId) {
          throw new ConflictException(
            'O motoboy não pode realizar uma entrega solicitada por ele mesmo.',
          );
        }
        const claimed = await tx.delivery.updateMany({
          where: { id, status: DeliveryStatus.SEARCHING, courierId: null },
          data: { courierId, status: DeliveryStatus.ASSIGNED },
        });
        if (claimed.count !== 1)
          throw new ConflictException(
            'Esta entrega já foi aceita ou não está disponível.',
          );
        await tx.deliveryEvent.create({
          data: {
            deliveryId: id,
            status: DeliveryStatus.ASSIGNED,
            actorId: actor.id,
            note:
              actor.role === UserRole.ADMIN
                ? 'Motoboy atribuído pelo administrador.'
                : 'Entrega aceita pelo motoboy.',
          },
        });
        return tx.delivery.findUniqueOrThrow({
          where: { id },
          select: detailSelect,
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'O motoboy já possui uma entrega em andamento.',
        );
      }
      throw error;
    }
  }

  async updateStatus(
    actor: Actor,
    id: string,
    status: UpdateDeliveryStatusDto['status'],
  ) {
    return this.prisma.$transaction(async (tx) => {
      const delivery = await tx.delivery.findUnique({
        where: { id },
        select: {
          status: true,
          courierId: true,
          courier: { select: { userId: true } },
        },
      });
      if (!delivery) throw new NotFoundException('Entrega não encontrada.');
      if (
        actor.role !== UserRole.ADMIN &&
        (actor.role !== UserRole.COURIER ||
          delivery.courier?.userId !== actor.id)
      ) {
        throw new ForbiddenException(
          'Somente o motoboy responsável ou o administrador pode atualizar esta entrega.',
        );
      }
      const expectedStatus: Record<
        UpdateDeliveryStatusDto['status'],
        DeliveryStatus
      > = {
        PICKED_UP: DeliveryStatus.ASSIGNED,
        IN_TRANSIT: DeliveryStatus.PICKED_UP,
        DELIVERED: DeliveryStatus.IN_TRANSIT,
      };
      if (!delivery.courierId || delivery.status !== expectedStatus[status]) {
        throw new ConflictException(
          'Esta mudança de situação não é permitida. Siga a sequência de coleta, transporte e entrega.',
        );
      }
      const updated = await tx.delivery.updateMany({
        where: {
          id,
          status: expectedStatus[status],
          courierId: delivery.courierId,
        },
        data: { status },
      });
      if (updated.count !== 1)
        throw new ConflictException(
          'A entrega foi alterada. Atualize a tela e tente novamente.',
        );
      const notes = {
        PICKED_UP: 'Encomenda coletada.',
        IN_TRANSIT: 'Motoboy a caminho do destino.',
        DELIVERED: 'Entrega concluída.',
      };
      await tx.deliveryEvent.create({
        data: {
          deliveryId: id,
          status,
          actorId: actor.id,
          note: notes[status],
        },
      });
      return tx.delivery.findUniqueOrThrow({
        where: { id },
        select: detailSelect,
      });
    });
  }

  async cancel(actor: Actor, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const delivery = await tx.delivery.findUnique({
        where: { id },
        select: { status: true, customer: { select: { userId: true } } },
      });
      if (!delivery) throw new NotFoundException('Entrega não encontrada.');
      if (
        actor.role !== UserRole.ADMIN &&
        delivery.customer.userId !== actor.id
      ) {
        throw new ForbiddenException(
          'Somente o cliente responsável ou o administrador pode cancelar esta entrega.',
        );
      }
      const cancellable: DeliveryStatus[] = [
        DeliveryStatus.PENDING,
        DeliveryStatus.SEARCHING,
        DeliveryStatus.ASSIGNED,
      ];
      if (!cancellable.includes(delivery.status))
        throw new ConflictException(
          'Só é possível cancelar antes da coleta da encomenda.',
        );
      const updated = await tx.delivery.updateMany({
        where: { id, status: delivery.status },
        data: { status: DeliveryStatus.CANCELLED },
      });
      if (updated.count !== 1)
        throw new ConflictException(
          'A entrega foi alterada. Atualize a tela e tente novamente.',
        );
      await tx.deliveryEvent.create({
        data: {
          deliveryId: id,
          status: DeliveryStatus.CANCELLED,
          actorId: actor.id,
          note: 'Entrega cancelada antes da coleta.',
        },
      });
      return tx.delivery.findUniqueOrThrow({
        where: { id },
        select: detailSelect,
      });
    });
  }
}
