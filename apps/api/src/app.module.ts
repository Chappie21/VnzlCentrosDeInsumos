import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { SentryModule, SentryGlobalFilter } from "@sentry/nestjs/setup";
import { RedisService } from "./redis.service";
import { RateLimitGuard, VoluntarioGuard, JefeGuard, IdentidadGuard, AdminGuard } from "./guards";
import { CentrosController, CentrosService } from "./centros";
import { HistorialController, HistorialService } from "./historial";
import { InsumosController, InsumosService } from "./insumos";
import { UsuariosController, UsuariosService } from "./usuarios";
import { EnviosController, EnviosService } from "./envios";
import { AdminController, AdminService } from "./admin";
import { CedulaService } from "./cedula";
import { AuthController } from "./auth/auth.controller";
import { AuthService } from "./auth/auth.service";

@Module({
  imports: [
    SentryModule.forRoot(),
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
    AuthController,
  ],
  providers: [
    // Captura excepciones no manejadas (500s) en Sentry; ignora 4xx esperados.
    { provide: APP_FILTER, useClass: SentryGlobalFilter },
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
    CedulaService,
    AuthService,
  ],
})
export class AppModule {}
