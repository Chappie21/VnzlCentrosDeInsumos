import { useId } from "react";
import Icon from "./Icon";

type FieldProps = {
  label: string;
  icon: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
};

export default function Field({
  label,
  icon,
  value,
  onChange,
  placeholder,
  error,
  type = "text",
  inputMode,
}: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant"
      >
        {label}
      </label>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-on-surface-variant">
          <Icon name={icon} />
        </div>
        <input
          id={id}
          type={type}
          inputMode={inputMode}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`block w-full rounded-lg border-2 bg-surface py-3 pl-10 pr-3 text-base text-on-surface transition-colors placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-1 focus:ring-safety focus:border-safety ${
            error ? "border-emergency" : "border-outline-variant"
          }`}
        />
      </div>
      {error && (
        <p id={errorId} className="mt-1 text-xs text-emergency">
          {error}
        </p>
      )}
    </div>
  );
}
