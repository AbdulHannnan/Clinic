import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * A signed-in patient booking themselves onto today's queue. Unlike {@link BookDto} there is no name or
 * phone: identity comes from the patient token, so the booking is always tied to their own account.
 */
export class MeBookDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  symptoms?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  age?: number;

  // true = pay at the clinic; false/omitted = intends to pay online (payment integration is out of scope).
  @IsOptional()
  @IsBoolean()
  payAtClinic?: boolean;
}
