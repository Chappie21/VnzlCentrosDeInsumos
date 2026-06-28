export const STORAGE = {
  fingerprint: "fingerprint", // solo rate limit (ya no es identidad)
  token: "token", // JWT de sesión de usuario
  identity: "identity", // cache local del perfil (nombre/cédula/teléfono)
  anon: "anon",
} as const;
