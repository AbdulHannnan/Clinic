import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import type { JwtPayload, StaffPrincipal } from './jwt.strategy';

const SALT_ROUNDS = 10;

/** Staff login with phone + password, and the token every staff screen carries. */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, SALT_ROUNDS);
  }

  async login(phone: string, password: string): Promise<{ token: string; staff: StaffPrincipal }> {
    const staff = await this.prisma.staffUser.findUnique({ where: { phone } });
    // Same error whether the phone is unknown, inactive, or the password is wrong.
    if (!staff || !staff.active || !(await bcrypt.compare(password, staff.passwordHash))) {
      throw new UnauthorizedException('Invalid phone or password');
    }
    const payload: JwtPayload = { sub: staff.id, role: staff.role, name: staff.name, doctorId: staff.doctorId };
    return {
      token: await this.jwt.signAsync(payload),
      staff: { id: staff.id, role: staff.role, name: staff.name, doctorId: staff.doctorId },
    };
  }

  /** Verify a raw token (used by the realtime gateway to guard staff rooms). */
  verifyToken(token: string): Promise<JwtPayload> {
    return this.jwt.verifyAsync<JwtPayload>(token);
  }

  /**
   * Verify a token and confirm the staff member is still active, for the realtime gateway's staff
   * rooms. Mirrors the HTTP JwtStrategy: a valid signature isn't enough, since a deactivated account's
   * token stays valid for hours. Returns the current principal, or null to refuse the room.
   */
  async authenticateStaffToken(token: string): Promise<StaffPrincipal | null> {
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      const staff = await this.prisma.staffUser.findUnique({
        where: { id: payload.sub },
        select: { id: true, role: true, name: true, doctorId: true, active: true },
      });
      if (!staff || !staff.active) return null;
      return { id: staff.id, role: staff.role, name: staff.name, doctorId: staff.doctorId };
    } catch {
      return null;
    }
  }
}
