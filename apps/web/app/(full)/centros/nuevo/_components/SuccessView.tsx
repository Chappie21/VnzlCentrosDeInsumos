import { Icon } from "../../../../_components";

type SuccessViewProps = {
  centroNombre: string;
  onVerCentro: () => void;
  onInvitar: () => void;
};

export default function SuccessView({
  centroNombre,
  onVerCentro,
  onInvitar,
}: SuccessViewProps) {
  return (
    <div className="mx-auto w-full max-w-md space-y-6 px-4 py-8 text-center">
      <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-success text-white">
        <Icon name="check_circle" filled className="text-5xl" />
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-on-surface">
          Centro de Acopio Registrado Exitosamente
        </h2>
        <p className="text-base text-on-surface-variant">
          El nuevo centro ha sido añadido a la red de respuesta y está listo para
          recibir suministros.
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-4 text-left">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Centro de Acopio
          </p>
          <p className="text-base text-on-surface">{centroNombre}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Estado
          </p>
          <span className="mt-1 inline-flex rounded-badge bg-safety px-2 py-1 text-xs font-bold uppercase tracking-wider text-white">
            Activo
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={onVerCentro}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-safety font-semibold text-white shadow-sm transition-colors hover:bg-[#1d4ed8] active:scale-[0.98]"
        >
          <Icon name="store" />
          Ver mi Centro de Acopio
        </button>

        <button
          type="button"
          onClick={onInvitar}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container text-on-surface-variant transition-colors hover:bg-surface-container-high active:scale-[0.98]"
        >
          <Icon name="group_add" />
          Invitar Ayudantes
        </button>
      </div>
    </div>
  );
}
