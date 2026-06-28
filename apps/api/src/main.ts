import "dotenv/config";
import "reflect-metadata";
import { join } from "path";
import * as express from "express";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  // Foto del local va como data URL base64 en JSON → subir el límite (default 100kb).
  app.use(express.json({ limit: "5mb" }));
  // Servir las fotos subidas (ponytail: disco local; object storage para prod).
  app.use("/uploads", express.static(join(process.cwd(), "uploads")));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(Number(process.env.API_PORT) || 3001);
}
bootstrap();
