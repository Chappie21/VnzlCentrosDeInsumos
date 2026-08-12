"use client";

import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import { useRouter } from "next/navigation";
import { googleLogin } from "../lib/authApi";
import { syncIdentity } from "../lib/identity";
import { ROUTES } from "../constants";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

// Único módulo que importa @react-oauth/google. Se carga con next/dynamic desde
// GoogleButton para que el paquete no entre al chunk compartido de todas las rutas.
// El provider vive acá junto al botón a propósito: si el botón lo importara desde
// otro archivo, el import estático volvería a arrastrar el paquete al bundle.
export default function GoogleAuthProvider() {
  const router = useRouter();
  // Sin client ID configurado, la app funciona igual (sin login con Google).
  if (!GOOGLE_CLIENT_ID) return null;
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="flex justify-center">
        <GoogleLogin
          onSuccess={async (cred) => {
            if (!cred.credential) return;
            try {
              const r = await googleLogin(cred.credential);
              if (r.needsProfile) {
                router.push("/completar-perfil");
                return;
              }
              await syncIdentity(); // poblar cache del perfil
              // push a una ruta distinta de "/" para que navegue de verdad
              // (push("/") desde la propia vista de login era no-op → quedaba ahí).
              router.push(ROUTES.misCentros);
            } catch {
              alert("No se pudo iniciar sesión con Google");
            }
          }}
          onError={() => alert("Error con Google")}
          text="continue_with"
        />
      </div>
    </GoogleOAuthProvider>
  );
}
