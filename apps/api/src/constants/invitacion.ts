// Invitación de voluntarios: JWT corto (1h) ligado a un centro (spec §4).
export const INVITACION = {
  expiresIn: "1h", // vida del JWT
  ttlMin: 60, // mismo lapso en minutos, para la UI
} as const;
