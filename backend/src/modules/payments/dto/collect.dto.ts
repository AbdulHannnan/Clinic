import { IsIn } from 'class-validator';
import { PaymentMethod } from '@clinic/shared';

/** Recording money taken at the desk for a visit. */
export class CollectDto {
  @IsIn([PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.ONLINE])
  method: PaymentMethod;
}
