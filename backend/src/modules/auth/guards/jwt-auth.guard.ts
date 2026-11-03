import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Rejects any request without a valid staff bearer token. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
