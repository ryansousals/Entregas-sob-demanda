import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

export interface AuthenticatedRequest {
  headers: {
    authorization?: string;
  };
  user?: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    role: string;
  };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const authorization = request.headers.authorization;

    const [type, token] = authorization?.split(' ') ?? [];

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Token não informado ou inválido.');
    }

    let payload: { sub?: unknown };

    try {
      payload = await this.jwtService.verifyAsync<{
        sub?: unknown;
      }>(token);
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado.');
    }

    if (typeof payload.sub !== 'string') {
      throw new UnauthorizedException('Token inválido.');
    }

    const user = await this.prisma.user.findUnique({
      where: {
        id: payload.sub,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado.');
    }

    request.user = user;

    return true;
  }
}
