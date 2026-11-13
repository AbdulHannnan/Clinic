import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { PatientPrincipal } from '../guards/patient-auth.guard';

/** The authenticated patient, read off the request the PatientAuthGuard populated. */
export const CurrentPatient = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PatientPrincipal => ctx.switchToHttp().getRequest<{ patient: PatientPrincipal }>().patient,
);
