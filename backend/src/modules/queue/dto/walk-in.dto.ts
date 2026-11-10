import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

/** Reception registering a patient who walked in (or an emergency). */
export class WalkInDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

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

  // Emergencies jump ahead of those still waiting and carry an "E" token.
  @IsOptional()
  @IsBoolean()
  emergency?: boolean;
}
