import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { StaffRole } from '@clinic/shared';
import { PrismaService } from '../../prisma/prisma.service';

/** What we put in the token and what every guarded request can read off `req.user`. */
export interface JwtPayload {
  sub: string; // staff user id
  role: StaffRole;
  name: string;
  doctorId: string | null;
}

export interface StaffPrincipal {
  id: string;
  role: StaffRole;
  name: string;
  doctorId: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /**
   * Re-check the staff member on every request rather than trusting the token's claims. A signed token
   * stays valid for hours, so a deactivated account, a deleted account, or a changed role would keep its
   * old access until the token expired. Reading the row each time means revocation and role/doctor
   * changes take effect immediately, and the principal always carries the current role and doctor.
   */
  async validate(payload: JwtPayload): Promise<StaffPrincipal> {
    const staff = await this.prisma.staffUser.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, name: true, doctorId: true, active: true },
    });
    if (!staff || !staff.active) throw new UnauthorizedException();
    return { id: staff.id, role: staff.role, name: staff.name, doctorId: staff.doctorId };
  }
}
