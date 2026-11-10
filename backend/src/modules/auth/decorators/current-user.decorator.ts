import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { StaffPrincipal } from '../jwt.strategy';

/** The authenticated staff member, read off the request the JwtStrategy populated. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): StaffPrincipal => ctx.switchToHttp().getRequest<{ user: StaffPrincipal }>().user,
);
