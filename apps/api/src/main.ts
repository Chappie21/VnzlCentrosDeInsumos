import "dotenv/config";
import "./instrument"; // Sentry: debe ir antes de importar el resto de la app.
import "reflect-metadata";
import { join } from "path";
import * as express from "express";
import helmet from "helmet";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // CORS: si WEB_ORIGIN está seteado (prod), solo ese/esos orígenes pueden llamar
  // a la API desde un browser. En dev (sin la var) se permite todo.
  // ponytail: CORS lo aplica el navegador; la protección REAL del admin es el JWT.
  const origins = (process.env.WEB_ORIGIN || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins.length ? origins : true, credentials: true });
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  // Foto del local va como data URL base64 en JSON → subir el límite (default 100kb).
  app.use(express.json({ limit: "5mb" }));
  // Servir las fotos subidas (ponytail: disco local; object storage para prod).
  app.use("/uploads", express.static(join(process.cwd(), "uploads")));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Doc pública (Swagger UI en /docs, spec en /docs-json). Solo los endpoints
  // marcados @ApiTags("publico") — los internos (admin/jefe/PII) NO se exponen.
  const config = new DocumentBuilder()
    .setTitle("Red Acopio Venezuela — API pública")
    .setDescription("Endpoints públicos (sin autenticación) para consultar centros de acopio y sus necesidades.")
    .setVersion("1.0")
    .build();
  const full = SwaggerModule.createDocument(app, config);
  const paths: typeof full.paths = {};
  for (const [ruta, metodos] of Object.entries(full.paths)) {
    const pub = Object.fromEntries(
      Object.entries(metodos).filter(([, op]) => (op as any).tags?.includes("publico")),
    );
    if (Object.keys(pub).length) paths[ruta] = pub;
  }
  // El plugin de Nest introspecta TODOS los DTOs a components.schemas (incluidos los
  // internos: LoginDto, EnvioDto, etc.). Podar a solo los referenciados por las rutas
  // públicas — si no, se filtra la superficie interna aunque paths esté filtrado.
  const refs = (obj: unknown, acc = new Set<string>()): Set<string> => {
    if (Array.isArray(obj)) obj.forEach((x) => refs(x, acc));
    else if (obj && typeof obj === "object")
      for (const [k, v] of Object.entries(obj)) {
        if (k === "$ref" && typeof v === "string") acc.add(v.split("/").pop()!);
        else refs(v, acc);
      }
    return acc;
  };
  const todas = full.components?.schemas ?? {};
  const usados = refs(paths);
  for (let n = -1; n !== usados.size; ) {
    n = usados.size;
    for (const s of [...usados]) refs(todas[s], usados); // transitivo
  }
  const schemas = Object.fromEntries(Object.entries(todas).filter(([k]) => usados.has(k)));
  SwaggerModule.setup("docs", app, { ...full, paths, components: { ...full.components, schemas } });
  // PORT lo inyectan las plataformas (Render/Railway/Cloud Run); API_PORT para dev local.
  await app.listen(Number(process.env.PORT) || Number(process.env.API_PORT) || 3001, "0.0.0.0");
}
bootstrap();
