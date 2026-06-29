"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon, Field, TopAppBar } from "../_components";
import { GoogleButton } from "../_components/GoogleButton";
import { register as registerUser } from "../lib/authApi";
import {
  normalizeCedula,
  normalizeTelefono,
  validateOnboarding,
} from "../lib/validate";

type RegistroInput = {
  nombre: string;
  cedula: string;
  telefono: string;
  password: string;
  passwordConfirm: string;
};

export default function RegistroPage() {
  const router = useRouter();
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid, isSubmitting },
  } = useForm<RegistroInput>({
    mode: "onChange",
    defaultValues: { nombre: "", cedula: "", telefono: "", password: "", passwordConfirm: "" },
    resolver: (values) => {
      const fieldErrors: Record<string, string> = {
        ...validateOnboarding({
          nombre: values.nombre,
          cedula: values.cedula,
          telefono: values.telefono,
        }),
      };
      if (values.password.length < 8) {
        fieldErrors.password = "La contraseña debe tener al menos 8 caracteres.";
      }
      if (values.passwordConfirm !== values.password) {
        fieldErrors.passwordConfirm = "Las contraseñas no coinciden.";
      }
      const hasErrors = Object.keys(fieldErrors).length > 0;
      return {
        values: hasErrors ? {} : values,
        errors: Object.fromEntries(
          Object.entries(fieldErrors).map(([name, message]) => [
            name,
            { type: "validate", message },
          ]),
        ),
      };
    },
  });

  async function onValid(values: RegistroInput) {
    setApiError(null);
    try {
      await registerUser({
        nombre: values.nombre.trim(),
        cedula: normalizeCedula(values.cedula),
        telefono: normalizeTelefono(values.telefono),
        password: values.password,
      });
      router.push("/"); // ya autenticado → la home muestra el perfil
    } catch (e) {
      setApiError(e instanceof Error ? e.message : "No se pudo crear la cuenta.");
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-surface text-on-surface">
      <TopAppBar />
      <main className="mx-auto flex w-full max-w-[1024px] flex-grow items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-8 rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
          <div className="space-y-2 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
              <Icon name="person_add" filled className="text-4xl" />
            </div>
            <h2 className="text-2xl font-semibold text-on-surface">Crear cuenta</h2>
            <p className="text-base text-on-surface-variant">
              Con tu cuenta puedes usar la app en cualquier dispositivo.
            </p>
          </div>

          <form onSubmit={handleSubmit(onValid)} className="space-y-6">
            <div className="space-y-4">
              <Field
                label="Nombre completo"
                icon="person"
                placeholder="Ingresa tu nombre"
                error={errors.nombre?.message}
                {...register("nombre")}
              />
              <Field
                label="Cédula de identidad"
                icon="badge"
                placeholder="V12345678"
                error={errors.cedula?.message}
                {...register("cedula")}
              />
              <Field
                label="Teléfono"
                icon="phone"
                type="tel"
                inputMode="tel"
                placeholder="04141234567"
                error={errors.telefono?.message}
                {...register("telefono")}
              />
              <Field
                label="Contraseña"
                icon="lock"
                type="password"
                placeholder="Mínimo 8 caracteres"
                error={errors.password?.message}
                {...register("password")}
              />
              <Field
                label="Confirmar contraseña"
                icon="lock"
                type="password"
                placeholder="Repite la contraseña"
                error={errors.passwordConfirm?.message}
                {...register("passwordConfirm")}
              />
            </div>

            {apiError && <p className="text-sm text-emergency">{apiError}</p>}

            <div className="space-y-4 pt-2">
              <button
                type="submit"
                disabled={!isValid || isSubmitting}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-action font-semibold text-white shadow-sm transition-colors hover:bg-[#5a4a26] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon name="person_add" />
                {isSubmitting ? "Creando…" : "Crear cuenta"}
              </button>

              <GoogleButton />

              <p className="text-center text-sm text-on-surface-variant">
                ¿Ya tienes cuenta?{" "}
                <Link href="/login" className="font-semibold text-primary-container underline hover:no-underline">
                  Inicia sesión
                </Link>
              </p>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
