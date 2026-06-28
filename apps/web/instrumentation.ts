import * as Sentry from "@sentry/nextjs";

// Next carga esto en el arranque del server/edge.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./sentry.server.config");
  if (process.env.NEXT_RUNTIME === "edge") await import("./sentry.edge.config");
}

// Reporta errores de requests del App Router a Sentry.
export const onRequestError = Sentry.captureRequestError;
