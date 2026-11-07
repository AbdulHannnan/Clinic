import { IsString, MaxLength, MinLength } from 'class-validator';

/** Staff login. `ValidationPipe({ whitelist })` strips anything not declared here. */
export class LoginDto {
  // Phone is the login id. Bounded so an unbounded string never reaches the DB lookup.
  @IsString()
  @MinLength(7)
  @MaxLength(20)
  phone: string;

  // Capped well above any real password; stops a megabyte body reaching bcrypt.
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;
}
