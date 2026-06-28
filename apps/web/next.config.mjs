import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = { reactStrictMode: true };

// Envuelve la config para subir source maps a Sentry (traces legibles en prod) y
// auto-instrumentar. La subida solo ocurre si hay SENTRY_AUTH_TOKEN + org/project;
// sin esas vars el plugin no rompe el build, solo omite la subida.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // authToken se lee de SENTRY_AUTH_TOKEN.
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
});
