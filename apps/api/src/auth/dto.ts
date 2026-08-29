import { Transform } from "class-transformer";
import {
  IsIn,
  IsNotEmpty,
  IsString,
  MinLength,
  ValidateIf,
} from "class-validator";
import {
  normalizarDocumento,
  normalizarTelefono,
  PAISES,
  type Pais,
} from "@vnzl/paises";
import { validacionActiva } from "../cedula";
import { IsDocumentoDePais, IsTelefonoDePais } from "../validators";

export class RegisterDto {
  @IsIn([...PAISES]) pais!: Pais;

  // Solo se teclea cuando no hay registro civil que lo provea: Colombia siempre,
  // y Venezuela únicamente si el portón de cédula está apagado. Con el portón
  // activo el nombre oficial es la fuente y lo que venga acá se ignora.
  @ValidateIf((o) => !validacionActiva(o.pais))
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  nombre!: string;

  @Transform(({ value, obj }) =>
    typeof value === "string" && obj?.pais
      ? normalizarDocumento(obj.pais, value)
      : value,
  )
  @IsDocumentoDePais()
  cedula!: string;

  @Transform(({ value }) =>
    typeof value === "string" ? normalizarTelefono(value) : value,
  )
  @IsTelefonoDePais()
  telefono!: string;

  @IsString() @MinLength(8) password!: string;
}

export class LoginDto {
  @IsString() cedula!: string;
  @IsString() password!: string;
}

export class GoogleDto {
  @IsString() idToken!: string;
}
