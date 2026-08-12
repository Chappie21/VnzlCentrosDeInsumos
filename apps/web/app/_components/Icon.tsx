import type { IconName } from "../constants/icons";

type IconProps = {
  // Tipado contra la lista blanca: un icono fuera del subset que pide layout.tsx
  // rompe el typecheck en vez de renderizar el ligature crudo en pantalla.
  name: IconName;
  className?: string;
  filled?: boolean;
};

export default function Icon({ name, className, filled }: IconProps) {
  return (
    <span
      className={`material-symbols-outlined${className ? ` ${className}` : ""}`}
      style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
      aria-hidden
    >
      {name}
    </span>
  );
}
