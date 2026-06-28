import { IsString, MinLength } from "class-validator";

export class RegisterDto {
  @IsString() nombre!: string;
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
