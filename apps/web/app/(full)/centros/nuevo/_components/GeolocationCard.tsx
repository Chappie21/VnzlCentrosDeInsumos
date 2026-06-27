import { Field, Icon } from "../../../../_components";
import type { Coords } from "../../../../_hooks";

type GeolocationCardProps = {
  coords: Coords | null;
  denied: boolean;
  onRequest: () => void;
  lat: string;
  lng: string;
};

export default function GeolocationCard({
  coords,
  denied,
  onRequest,
  lat,
  lng,
}: GeolocationCardProps) {
  return (
    <div className="space-y-4 rounded-lg border border-outline-variant bg-surface-container-lowest p-4">
      <div className="flex items-center gap-2 text-on-surface">
        <span className="text-on-surface-variant">
          <Icon name="settings" />
        </span>
        <h3 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">
          Geolocalización
        </h3>
      </div>

      <button
        type="button"
        onClick={onRequest}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-safety font-semibold text-white shadow-sm transition-colors hover:bg-[#1d4ed8] active:scale-[0.98]"
      >
        <Icon name="my_location" />
        Obtener Ubicación Actual
      </button>

      {denied && (
        <p className="text-xs text-emergency">
          Permiso de ubicación denegado. Podés ingresar las coordenadas o
          intentarlo de nuevo desde los ajustes del navegador.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Latitud"
          icon="north"
          readOnly
          placeholder="00.000000"
          value={lat}
        />
        <Field
          label="Longitud"
          icon="east"
          readOnly
          placeholder="00.000000"
          value={lng}
        />
      </div>

      {/* ponytail: vista previa estática; mejorar a imagen de static-map más adelante. */}
      <div className="flex h-32 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-outline-variant text-on-surface-variant">
        <span className="text-3xl">
          <Icon name="map" />
        </span>
        <span className="text-xs font-bold uppercase tracking-wider">
          Vista Previa
        </span>
        {coords && (
          <span className="text-xs">
            {lat}, {lng}
          </span>
        )}
      </div>
    </div>
  );
}
