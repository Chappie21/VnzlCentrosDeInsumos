"use client";

import { GoogleLogin } from "@react-oauth/google";
import { useRouter } from "next/navigation";
import { googleLogin } from "../lib/authApi";
import { syncIdentity } from "../lib/identity";

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
            router.push("/");
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
