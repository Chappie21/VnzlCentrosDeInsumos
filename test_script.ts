import { validate } from 'class-validator';
import "reflect-metadata";
import { Min, IsInt, IsString } from 'class-validator';
import { Type, plainToInstance } from 'class-transformer';

class MovimientoDto {
  @IsString() insumoId: string;
  @IsInt() cantidad: number;
}

class MovimientoPositivoDto extends MovimientoDto {
  @IsInt() @Min(1) declare cantidad: number;
}

const dto = plainToInstance(MovimientoPositivoDto, { insumoId: "a", cantidad: -1 });
validate(dto).then(errors => console.log("MovimientoPositivoDto errors:", errors.length));
