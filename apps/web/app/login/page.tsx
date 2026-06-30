"use client";

import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Icon, Field } from "../_components";
import { AuthShell, StatusFooter } from "../_components/AuthShell";
import { GoogleButton } from "../_components/GoogleButton";
import { ROUTES } from "../constants";
import { login } from "../lib/authApi";
import { normalizeCedula } from "../lib/validate";
import { setIdentity, syncIdentity } from "../lib/identity";

type LoginInput = { cedula: string; password: string };

function LoginView() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || ROUTES.misCentros;
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    mode: "onChange",
    defaultValues: { cedula: "", password: "" },
  });

  async function onValid(values: LoginInput) {
    setApiError(null);
    try {
      const { usuario } = await login(normalizeCedula(values.cedula), values.password);
      if (usuario.nombre && usuario.cedula && usuario.telefono) {
        setIdentity({ nombre: usuario.nombre, cedula: usuario.cedula, telefono: usuario.telefono });
      } else {
        await syncIdentity();
      }
      router.push(next);
    } catch (e) {
      setApiError(e instanceof Error ? e.message : "Cédula o contraseña inválida");
    }
  }

  return (
    <AuthShell>
      <div className="space-y-2 text-center">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
          <Icon name="login" filled className="text-4xl" />
        </div>
        <h2 className="text-2xl font-semibold text-on-surface">Iniciar sesión</h2>
        <p className="text-base text-on-surface-variant">
          Para administrar un centro o ser voluntario.
        </p>
      </div>

      <form onSubmit={handleSubmit(onValid)} className="space-y-6">
        <div className="space-y-4">
          <Field
            label="Cédula de identidad"
            icon="badge"
            placeholder="V12345678"
            error={errors.cedula?.message}
            {...register("cedula", { required: "Ingresa tu cédula" })}
          />
          <Field
            label="Contraseña"
            icon="lock"
            type="password"
            placeholder="••••••••"
            error={errors.password?.message}
            {...register("password", { required: "Ingresa tu contraseña" })}
          />
        </div>

        {apiError && <p className="text-sm text-emergency">{apiError}</p>}

        <div className="space-y-4 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-action font-semibold text-white shadow-sm transition-colors hover:bg-[#5a4a26] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="login" />
            {isSubmitting ? "Entrando…" : "Entrar"}
          </button>

          <GoogleButton />

          <p className="text-center text-sm text-on-surface-variant">
            ¿No tienes cuenta?{" "}
            <Link href="/registro" className="font-semibold text-primary-container underline hover:no-underline">
              Regístrate
            </Link>
          </p>

          <Link
            href={ROUTES.centros}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container text-on-surface-variant transition-colors hover:bg-surface-container-high"
          >
            <Icon name="visibility" />
            Solo quiero ver los centros
          </Link>
        </div>
      </form>

      <StatusFooter />
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginView />
    </Suspense>
  );
}
