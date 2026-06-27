import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { RedisService } from "./redis.service";
import { RateLimitGuard, VoluntarioGuard, JefeGuard, IdentidadGuard } from "./guards";
import { CentrosController, CentrosService } from "./centros";
import { HistorialController, HistorialService } from "./historial";
import { InsumosController, InsumosService } from "./insumos";
import { UsuariosController, UsuariosService } from "./usuarios";
import { EnviosController, EnviosService } from "./envios";

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || "dev-only-change-me",
    }),
  ],
  controllers: [
    CentrosController,
    HistorialController,
    InsumosController,
    UsuariosController,
    EnviosController,
  ],
  providers: [
    RedisService,
    RateLimitGuard,
    VoluntarioGuard,
    JefeGuard,
    IdentidadGuard,
    CentrosService,
    HistorialService,
    InsumosService,
    UsuariosService,
    EnviosService,
  ],
})
export class AppModule {}
