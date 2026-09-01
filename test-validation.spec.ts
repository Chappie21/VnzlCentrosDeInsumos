import { validate } from 'class-validator';
import { IsInt, Min, IsString, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

class MovimientoDto {
  @IsString() insumoId!: string;
  @IsInt() cantidad!: number;
}

class AddDto extends MovimientoDto {
  @IsString() centroId!: string;
  @IsInt() @Min(1) declare cantidad: number;
}

async function run() {
  const dto = new AddDto();
  dto.insumoId = "i1";
  dto.centroId = "c1";
  dto.cantidad = -5;
  const errors = await validate(dto);
  console.log(errors);
}
run();
