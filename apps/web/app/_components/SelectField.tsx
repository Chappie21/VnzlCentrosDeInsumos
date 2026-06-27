import { forwardRef, useId } from "react";
import type { SelectHTMLAttributes } from "react";
import Icon from "./Icon";

type SelectFieldProps = {
  label: string;
  icon: string;
  error?: string;
  placeholder?: string;
  options: readonly string[];
} & SelectHTMLAttributes<HTMLSelectElement>;

// Select nativo (sin librería de combobox): estilado como Field para que la
// cascada estado→ciudad use datos estáticos sin dependencias extra.
const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  function SelectField({ label, icon, error, placeholder, options, ...rest }, ref) {
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
          <select
            id={id}
            ref={ref}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={`block w-full appearance-none rounded-lg border-2 bg-surface py-3 pl-10 pr-10 text-base text-on-surface transition-colors focus:outline-none focus:ring-1 focus:ring-safety focus:border-safety disabled:cursor-not-allowed disabled:opacity-50 ${
              error ? "border-emergency" : "border-outline-variant"
            }`}
            {...rest}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-on-surface-variant">
            <Icon name="expand_more" />
          </div>
        </div>
        {error && (
          <p id={errorId} className="mt-1 text-xs text-emergency">
            {error}
          </p>
        )}
      </div>
    );
  },
);

export default SelectField;
