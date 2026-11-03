import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { StaffRole } from '@clinic/shared';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { StaffPrincipal } from '../jwt.strategy';

/** Allows the request only when the authenticated staff member has one of the required roles. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<StaffRole[] | undefined>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!roles || roles.length === 0) return true;
    const user = ctx.switchToHttp().getRequest<{ user?: StaffPrincipal }>().user;
    return !!user && roles.includes(user.role);
  }
}
