"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Field, Icon, SelectField, TextAreaField } from "../../../../_components";
import { useGeolocation } from "../../../../_hooks";
import type { Coords } from "../../../../_hooks";
import { validateCentro, type CentroInput } from "../../../../lib/validate";
import type { CreateCentroBody } from "../../../../lib/api";
import { ESTADOS, municipiosDe } from "../../../../constants";
import GeolocationCard from "./GeolocationCard";

const fmt = (n: number) => n.toFixed(6);

type Props = {
  defaultValues: CentroInput;
  initialPoint?: Coords | null;
  description?: string;
  submitLabel: string;
  pendingLabel: string;
  pending: boolean;
  apiError: string | null;
  // Valida al montar (útil al editar: el form ya viene precargado y válido).
  validateOnMount?: boolean;
  onSubmit: (body: CreateCentroBody) => void;
};

// Formulario compartido por crear y editar un centro: campos + cascada
// estado→ciudad + mapa/geolocalización. El padre maneja la mutación y el resultado.
export default function CentroForm({
  defaultValues,
  initialPoint = null,
  description,
  submitLabel,
  pendingLabel,
  pending,
  apiError,
  validateOnMount = false,
  onSubmit,
}: Props) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    trigger,
    formState: { errors, isValid },
  } = useForm<CentroInput>({
    mode: "onChange",
    defaultValues,
    // Reutiliza las mismas reglas que el backend mapeándolas al formato de RHF.
    resolver: (values) => {
      const fieldErrors = validateCentro(values);
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

  const { coords, denied, request } = useGeolocation();
  // Punto seleccionado: lo fija la geolocalización o un toque/arrastre en el mapa.
  const [point, setPoint] = useState<Coords | null>(initialPoint);
  const [recenterKey, setRecenterKey] = useState(0);

  useEffect(() => {
    if (validateOnMount) trigger();
  }, [validateOnMount, trigger]);

  // Geolocalización -> mueve el punto y recentra el mapa.
  useEffect(() => {
    if (!coords) return;
    setPoint(coords);
    setRecenterKey((k) => k + 1);
  }, [coords]);

  // El punto (venga del mapa o del GPS) alimenta el form.
  useEffect(() => {
    if (!point) return;
    setValue("latitud", point.lat, { shouldValidate: true });
    setValue("longitud", point.lng, { shouldValidate: true });
  }, [point, setValue]);

  // Cascada: al CAMBIAR el estado, la ciudad deja de ser válida. Comparamos contra el
  // estado previo (no un flag de montaje): así preserva la ciudad precargada al editar
  // y es inmune al doble-efecto de StrictMode (que con un flag booleano la borraba).
  const estado = watch("estado");
  const estadoPrevio = useRef(estado);
  useEffect(() => {
    if (estadoPrevio.current === estado) return; // montaje o sin cambio real
    estadoPrevio.current = estado;
    setValue("ciudad", "", { shouldValidate: true });
  }, [estado, setValue]);

  function onValid(values: CentroInput) {
    onSubmit({
      nombre: values.nombre.trim(),
      ciudad: values.ciudad.trim(),
      estado: values.estado.trim(),
      direccion: values.direccion.trim(),
      ...(point ? { latitud: point.lat, longitud: point.lng } : {}),
    });
  }

  return (
    <form
      onSubmit={handleSubmit(onValid)}
      className="mx-auto flex w-full max-w-md flex-grow flex-col"
    >
      <div className="flex-grow space-y-6 px-4 py-6">
        {description && (
          <p className="text-base text-on-surface-variant">{description}</p>
        )}

        <Field
          label="Nombre del Centro"
          icon="store"
          placeholder="Ej. Centro Deportivo Municipal"
          error={errors.nombre?.message}
          {...register("nombre")}
        />

        <div className="grid grid-cols-2 gap-4">
          <SelectField
            label="Estado / Provincia"
            icon="map"
            placeholder="Estado"
            options={ESTADOS}
            defaultValue=""
            error={errors.estado?.message}
            {...register("estado")}
          />
          <SelectField
            label="Ciudad"
            icon="location_city"
            placeholder={estado ? "Ciudad" : "Elige estado"}
            options={municipiosDe(estado)}
            defaultValue=""
            disabled={!estado}
            error={errors.ciudad?.message}
            {...register("ciudad")}
          />
        </div>

        <TextAreaField
          label="Dirección Completa"
          placeholder="Calle, Número, Colonia, C.P."
          error={errors.direccion?.message}
          {...register("direccion")}
        />

        <GeolocationCard
          coords={point}
          denied={denied}
          onRequest={request}
          onPick={setPoint}
          recenterKey={recenterKey}
          lat={point ? fmt(point.lat) : ""}
          lng={point ? fmt(point.lng) : ""}
        />

        {apiError && <p className="text-sm text-emergency">{apiError}</p>}
      </div>

      <div className="sticky bottom-0 border-t border-outline-variant bg-surface px-4 py-4">
        <button
          type="submit"
          disabled={!isValid || pending}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-action font-semibold text-white shadow-sm transition-colors hover:bg-[#5a4a26] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name="check" />
          {pending ? pendingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}
