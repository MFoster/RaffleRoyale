import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthContext } from './auth.types';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class HeaderAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      auth?: AuthContext;
    }>();

    const userId = this.extractHeaderValue(request.headers['x-user-id']);
    if (!userId) {
      throw new UnauthorizedException('Missing x-user-id header');
    }

    const roleHeader = this.extractHeaderValue(request.headers['x-user-role']);
    const role = roleHeader === 'ADMIN' ? 'ADMIN' : 'USER';

    request.auth = {
      userId,
      role: role,
    };

    return true;
  }

  private extractHeaderValue(
    value: string | string[] | undefined,
  ): string | undefined {
    if (Array.isArray(value)) {
      return value[0];
    }

    return value;
  }
}
