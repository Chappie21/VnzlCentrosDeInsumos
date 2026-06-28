import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { RedisService } from "./redis.service";
import { RateLimitGuard, VoluntarioGuard, JefeGuard, IdentidadGuard, AdminGuard } from "./guards";
import { CentrosController, CentrosService } from "./centros";
import { HistorialController, HistorialService } from "./historial";
import { InsumosController, InsumosService } from "./insumos";
import { UsuariosController, UsuariosService } from "./usuarios";
import { EnviosController, EnviosService } from "./envios";
import { AdminController, AdminService } from "./admin";

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
    AdminController,
  ],
  providers: [
    RedisService,
    RateLimitGuard,
    VoluntarioGuard,
    JefeGuard,
    IdentidadGuard,
    AdminGuard,
    CentrosService,
    HistorialService,
    InsumosService,
    UsuariosService,
    EnviosService,
    AdminService,
  ],
})
export class AppModule {}
