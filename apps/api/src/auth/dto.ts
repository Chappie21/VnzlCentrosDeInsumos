import { IsString, MinLength } from "class-validator";

// El nombre NO se teclea: sale del registro oficial al validar la cédula.
export class RegisterDto {
  @IsString() cedula!: string;
  @IsString() telefono!: string;
  @IsString() @MinLength(8) password!: string;
}

export class LoginDto {
  @IsString() cedula!: string;
  @IsString() password!: string;
}

export class GoogleDto {
  @IsString() idToken!: string;
}
