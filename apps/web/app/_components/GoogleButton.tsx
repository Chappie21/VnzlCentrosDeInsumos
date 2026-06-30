"use client";

import { GoogleLogin } from "@react-oauth/google";
import { useRouter } from "next/navigation";
import { googleLogin } from "../lib/authApi";
import { syncIdentity } from "../lib/identity";
import { ROUTES } from "../constants";

const ENABLED = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

// Botón "Continuar con Google". Si no hay client ID configurado, no se muestra.
export function GoogleButton() {
  const router = useRouter();
  if (!ENABLED) return null;
  return (
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
  );
}
