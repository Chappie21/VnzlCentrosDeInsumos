import * as Sentry from "@sentry/nestjs";

// Init de Sentry — debe importarse ANTES que el resto de la app (ver main.ts).
// Lean (free tier): solo errores, sin performance ni profiling. No-op sin DSN.
const dsn = process.env.SENTRY_DSN;
Sentry.init({
  dsn,
  enabled: Boolean(dsn) && process.env.NODE_ENV === "production",
  environment: process.env.SENTRY_ENV ?? process.env.NODE_ENV ?? "development",
  tracesSampleRate: 0,
});
