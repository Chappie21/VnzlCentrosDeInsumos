import * as Sentry from "@sentry/nextjs";

// Next carga esto en el cliente automáticamente. Lean: solo errores, sin replay.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
Sentry.init({
  dsn,
  enabled: Boolean(dsn) && process.env.NODE_ENV === "production",
  environment: process.env.NEXT_PUBLIC_SENTRY_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0,
});

// Captura errores de navegación del App Router.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
