import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../prisma/prisma.service';

/** Patient token payload. `kind` keeps it distinct from a staff token signed with the same secret. */
export interface PatientJwtPayload {
  sub: string; // patient id
  kind: 'patient';
  name: string;
}

export interface PatientPrincipal {
  id: string;
  name: string;
}

/**
 * Guards the patient portal. Separate from the staff JwtStrategy so a patient token can never pass a
 * staff guard (and vice versa): it requires `kind: 'patient'` and re-checks the patient still exists.
 */
@Injectable()
export class PatientAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; patient?: PatientPrincipal }>();
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new UnauthorizedException();

    let payload: PatientJwtPayload;
    try {
      payload = await this.jwt.verifyAsync<PatientJwtPayload>(token);
    } catch {
      throw new UnauthorizedException();
    }
    if (payload.kind !== 'patient') throw new UnauthorizedException();

    const patient = await this.prisma.patient.findUnique({ where: { id: payload.sub }, select: { id: true, name: true } });
    if (!patient) throw new UnauthorizedException();
    req.patient = { id: patient.id, name: patient.name };
    return true;
  }
}
