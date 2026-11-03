import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { StaffRole } from '@clinic/shared';

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
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  validate(payload: JwtPayload): StaffPrincipal {
    return { id: payload.sub, role: payload.role, name: payload.name, doctorId: payload.doctorId };
  }
}
