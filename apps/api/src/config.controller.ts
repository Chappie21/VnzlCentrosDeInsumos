import { Controller, Get, Header } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { cedulaValidacionVe, flagsSincronizados } from "./feature-flags";

// Espejo de solo lectura de los feature flags que el frontend necesita para
// pintar la UI coherente con lo que la API va a exigir. Railway es la fuente de
// verdad; esto evita tener una segunda copia del flag en Vercel que se pueda
// desincronizar (con el portón apagado el registro venezolano tiene que pedir el
// nombre, y si el form no lo pide la API responde 400 en loop).
//
// Público a propósito: no expone nada sensible, solo si un campo del formulario
// de registro es obligatorio.
@Controller("config")
export class ConfigController {
  @Get("flags")
  @ApiTags("publico")
  @ApiOperation({ summary: "Feature flags que afectan a los formularios públicos" })
  @ApiOkResponse({ schema: { example: { cedulaValidacionVe: true, sincronizado: true } } })
  // 30s de cache compartida: el kill switch tarda a lo sumo medio minuto en
  // llegar al frontend, y no le pega a la API en cada render.
  @Header("cache-control", "public, max-age=0, s-maxage=30, stale-while-revalidate=60")
  flags() {
    return {
      // Con el portón activo el nombre lo pone el registro civil venezolano y el
      // formulario NO debe pedirlo. Apagado, pasa a ser obligatorio.
      cedulaValidacionVe: cedulaValidacionVe(),
      // false = el registro de Railway no sincronizó y se están sirviendo los
      // defaults. Útil para diagnosticar por qué un flip no se ve reflejado.
      sincronizado: flagsSincronizados(),
    };
  }
}
