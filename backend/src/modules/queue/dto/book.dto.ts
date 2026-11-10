import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

/** A patient booking themselves onto a doctor's queue. ValidationPipe({ whitelist }) strips extras. */
export class BookDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  // Phone is the patient's identity; bounded so an unbounded string never reaches the DB.
  @IsString()
  @MinLength(7)
  @MaxLength(20)
  phone: string;

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
